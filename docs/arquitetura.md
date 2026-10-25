# Arquitetura — Fase 4 (microsserviços + Saga)

## Visão geral

```mermaid
flowchart LR
    subgraph clientes["Usuários"]
        staff["Atendente / Mecânico<br/>(JWT staff)"]
        cliente["Cliente<br/>(JWT por CPF)"]
        mp["Mercado Pago<br/>(Checkout Pro + Webhooks)"]
    end

    subgraph aws["AWS"]
        apigw["API Gateway + Lambda<br/>POST /auth/cpf<br/>(repo serverless)"]

        subgraph eks["EKS — namespace oficina-mecanica"]
            os["os-service<br/>OS · clientes · veículos · catálogo<br/><b>Orquestrador da Saga</b><br/>+ Outbox / Inbox"]
            billing["billing-service<br/>Orçamentos · Pagamentos<br/>Mercado Pago"]
            exec["exec-prod-service<br/>Fila de execução<br/>Diagnóstico · Reparo"]
        end

        rds[("RDS PostgreSQL<br/>(SQL — os-service)")]
        ddbB[("DynamoDB<br/>*-billing<br/>(NoSQL)")]
        ddbE[("DynamoDB<br/>*-executions<br/>(NoSQL)")]

        q1[["SQS *-billing-commands<br/>+ DLQ"]]
        q2[["SQS *-execution-commands<br/>+ DLQ"]]
        q3[["SQS *-os-saga-replies<br/>+ DLQ"]]
    end

    nr["New Relic<br/>APM · Distributed Tracing<br/>Dashboards · Alertas"]

    cliente --> apigw
    apigw -. lê ClientPF .-> rds
    staff & cliente -->|REST| os
    staff -->|REST| exec
    staff -->|REST| billing
    mp -->|webhook| billing
    billing -->|preferência / estorno| mp

    os --- rds
    billing --- ddbB
    exec --- ddbE

    os -->|CreateBudget · RequestPayment<br/>CancelBudget · RefundPayment| q1 --> billing
    os -->|StartExecution · CancelExecution| q2 --> exec
    billing -->|BudgetCreated · PaymentConfirmed ...| q3
    exec -->|ExecutionQueued · ExecutionCompleted ...| q3
    q3 --> os

    os -. "GET /internal/... (REST síncrono,<br/>timeout + circuit breaker)" .-> billing
    os -.-> exec

    os & billing & exec -. agente APM .-> nr
```

| Serviço | Repositório | Responsabilidade | Banco | Porta |
|---|---|---|---|---|
| **os-service** | `soat-fiap-oficina-mecanica-os-service` | Abertura/status/histórico da OS, clientes, veículos, catálogo e estoque, login de funcionários. **Orquestra a saga.** | PostgreSQL (RDS) | 4000 |
| **billing-service** | `soat-fiap-oficina-mecanica-billing-service` | Orçamento (aprovação), cobrança Mercado Pago, webhook, estorno | DynamoDB | 4100 |
| **exec-prod-service** | `soat-fiap-oficina-mecanica-exec-prod` | Fila de execução, diagnóstico, reparo, conclusão/falha | DynamoDB | 4200 |

Cada serviço tem **repositório, pipeline, imagem Docker, manifestos Kubernetes, Terraform
(filas/tabelas/IAM) e banco próprios**. Nenhum serviço acessa o banco de outro: tudo que
cruza fronteira passa por mensagem (SQS) ou REST.

> A Lambda de login por CPF (repositório `serverless`) lê a tabela `ClientPF` do banco do
> os-service. Ela é tratada como parte do mesmo *bounded context* (identidade do cliente,
> dono dos dados = os-service) e só faz leitura — não é outro microsserviço de negócio.

## Saga orquestrada da OS

```mermaid
sequenceDiagram
    autonumber
    actor A as Atendente
    actor C as Cliente
    participant OS as os-service (orquestrador)
    participant B as billing-service
    participant MP as Mercado Pago
    participant E as exec-prod-service

    A->>OS: POST /orders (serviços + peças)
    Note over OS: 1 transação: OS RECEBIDA + reserva de peças<br/>+ saga BUDGET_PENDING + CreateBudget no outbox
    OS-)B: CreateBudget
    B-)OS: BudgetCreated (total)
    Note over OS: OS AGUARDANDO_APROVACAO

    C->>OS: POST /track/:id/approve
    OS-)B: RequestPayment
    B->>MP: POST /checkout/preferences
    B-)OS: PaymentRequested (checkoutUrl)
    C->>MP: paga no Checkout Pro
    MP->>B: webhook (x-signature)
    B->>MP: GET /v1/payments/:id
    B-)OS: PaymentConfirmed
    Note over OS: OS AGUARDANDO_EXECUCAO
    OS-)E: StartExecution
    E-)OS: ExecutionQueued
    A->>E: diagnóstico / reparo / conclusão
    E-)OS: ExecutionStatusChanged / ExecutionCompleted
    Note over OS: OS FINALIZADA · saga COMPLETED
```

### Compensações (rollback semântico)

| Falha | Onde | Compensações enviadas | Locais |
|---|---|---|---|
| Orçamento inválido (`BudgetCreationFailed`) | billing | — | devolve peças ao estoque, OS `CANCELADA` |
| Cliente recusa / atendente cancela antes do pagamento | os-service | `CancelBudget` | idem |
| Cobrança não gerada / pagamento recusado (`PaymentFailed`) | billing / Mercado Pago | `CancelBudget` | idem |
| Oficina lotada (`ExecutionRejected`) | exec-prod | `RefundPayment` (estorno MP + cancela orçamento) | idem |
| Falha no reparo (`ExecutionFailed`) | exec-prod | `RefundPayment` | idem |
| Cancelamento com OS na fila/em execução | os-service | `CancelExecution` + `RefundPayment` | idem |
| Etapa parada além do limite (timeout) | os-service | conforme etapa | idem |
| Estorno recusado (`PaymentRefundFailed`) | Mercado Pago | — (sem rollback automático) | saga `FAILED` + **alerta New Relic** |

A decisão de **quais** compensações executar fica na entidade de domínio
[`OrderSaga.startCompensation`](../src/domain/saga/OrderSaga.js), a partir do que já foi
efetivado (orçamento criado? pagamento confirmado? execução na fila?). A saga fica
`COMPENSATING` até cada participante confirmar (`BudgetCancelled`, `PaymentRefunded`,
`ExecutionCancelled`) e então `COMPENSATED`.

```mermaid
stateDiagram-v2
    [*] --> BUDGET_PENDING: OS aberta
    BUDGET_PENDING --> AWAITING_APPROVAL: BudgetCreated
    AWAITING_APPROVAL --> PAYMENT_PENDING: cliente aprova
    PAYMENT_PENDING --> EXECUTION_PENDING: PaymentConfirmed
    EXECUTION_PENDING --> IN_EXECUTION: ExecutionQueued
    IN_EXECUTION --> DONE: ExecutionCompleted
    DONE --> [*]: COMPLETED

    BUDGET_PENDING --> COMPENSATION: falha / timeout
    AWAITING_APPROVAL --> COMPENSATION: recusa / cancelamento / timeout
    PAYMENT_PENDING --> COMPENSATION: PaymentFailed / timeout
    EXECUTION_PENDING --> COMPENSATION: ExecutionRejected
    IN_EXECUTION --> COMPENSATION: ExecutionFailed / cancelamento
    COMPENSATION --> [*]: COMPENSATED (todas confirmadas)
    COMPENSATION --> [*]: FAILED (compensação falhou)
```

## Garantias de consistência

| Problema | Solução | Onde |
|---|---|---|
| OS gravada mas comando não enviado (ou o contrário) | **Transactional Outbox**: mudança de estado + mensagem na mesma transação PostgreSQL; `OutboxRelay` publica depois (`FOR UPDATE SKIP LOCKED`) | os-service |
| Evento do mecânico perdido se o SQS falhar | **Outbox no próprio item** DynamoDB (escrita atômica) + republicação periódica via índice esparso `gsi2` | exec-prod |
| Mensagem entregue mais de uma vez (SQS at-least-once) | **Inbox** (`ProcessedMessage`, `ON CONFLICT DO NOTHING`) no orquestrador; *conditional writes* + handlers idempotentes nos participantes | todos |
| Duas réplicas atualizando a mesma saga/registro | **Lock otimista** (`version`) — conflito desfaz a transação e o SQS reentrega | todos |
| Mensagem que nunca processa (bug, dado inválido) | **DLQ** por fila (`maxReceiveCount = 5`, retenção 14 dias) | Terraform de cada serviço |
| Participante não responde | **Timeout por etapa** da saga → compensação | os-service |
| Cliente paga um link antigo de OS já cancelada | **Estorno automático** no billing | billing |
| Cobrança/estorno duplicado no Mercado Pago | `X-Idempotency-Key` em toda escrita | billing |
| Serviço remoto lento/fora em consultas síncronas | **Timeout + circuit breaker + resposta degradada** | os-service |

## Comunicação

- **Assíncrona (SQS)** — todo o fluxo transacional da saga (comandos e respostas). Contratos em [mensageria.md](mensageria.md).
- **Síncrona (REST)** — somente consultas: `GET /api/orders/:id/progress` e `GET /api/track/:externalId`
  do os-service compõem a visão da OS chamando `GET /api/internal/...` do billing e do exec-prod
  pelo DNS interno do Kubernetes, com JWT de serviço (`role: SERVICE`, 60s). Nenhuma escrita
  depende de chamada síncrona entre serviços.

## Observabilidade (ferramentas da Fase 3)

- **New Relic APM** nos três serviços (`oficina-os-service`, `oficina-billing-service`,
  `oficina-exec-prod-service`), com **Distributed Tracing atravessando o SQS**: o produtor
  injeta os headers W3C/New Relic no envelope (`traceHeaders`) e o consumidor os aceita numa
  *background transaction* — uma OS aparece como um único trace HTTP → SQS → billing → SQS → os-service.
- **Logs estruturados** (pino) com `x-request-id`, `sagaId`, `orderId` e `correlationId`, correlacionados ao trace.
- **Eventos de negócio**: `SagaStarted`, `SagaStepCompleted`, `SagaCompensationStarted`,
  `SagaCompensated`, `SagaCompleted`, `SagaFailed`, `PaymentStatusChanged`, `ExecutionStatusChanged`
  → página **"Saga e Microsserviços"** do dashboard e alertas (`SagaFailed`, pico de compensações)
  no repositório `infra-kube`.
- **Healthchecks** `GET /health` nas probes do Kubernetes; HPA por CPU/memória em cada serviço.
