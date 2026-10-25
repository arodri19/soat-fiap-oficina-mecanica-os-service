# Tech Challenge — Fase 4 (12SOAT) — Documento de entrega

## Participantes

| Nome | RM | Discord / e-mail |
|---|---|---|
| _preencher_ | _preencher_ | _preencher_ |

## Links

| Item | Link |
|---|---|
| Vídeo de demonstração (≤ 15 min) | _preencher (YouTube/Vimeo, público ou não listado)_ |
| OS Service (orquestrador da saga) | https://github.com/arodri19/soat-fiap-oficina-mecanica-os-service |
| Billing Service (orçamento + Mercado Pago) | https://github.com/arodri19/soat-fiap-oficina-mecanica-billing-service |
| Execution & Production Service | https://github.com/arodri19/soat-fiap-oficina-mecanica-exec-prod |
| Infra Kubernetes (EKS + New Relic) | https://github.com/arodri19/soat-fiap-oficina-mecanica-infra-kube |
| Infra de dados (RDS) | https://github.com/arodri19/soat-fiap-oficina-mecanica-infra-data |
| Serverless (login por CPF, API Gateway, webhook https) | https://github.com/arodri19/soat-fiap-oficina-mecanica-serverless |

## Diagrama geral da arquitetura

Ver [arquitetura.md](arquitetura.md) (diagramas Mermaid de componentes, sequência da saga e
máquina de estados). Resumo:

- **os-service** (Node.js/Express, Prisma) — PostgreSQL/RDS — orquestrador da saga
- **billing-service** (Node.js/Express) — DynamoDB — Mercado Pago Checkout Pro + webhook
- **exec-prod-service** (Node.js/Express) — DynamoDB — fila de execução
- **Amazon SQS**: `*-billing-commands`, `*-execution-commands`, `*-os-saga-replies` (cada uma com DLQ)
- **REST síncrono** apenas para consultas consolidadas (timeout + circuit breaker)
- **EKS** (um Deployment + HPA por serviço), **API Gateway + Lambda** (login por CPF e webhook https),
  **New Relic** (APM, distributed tracing pelo SQS, dashboard da saga, alertas)

## Estratégia do Saga Pattern: orquestração

Orquestrador central no os-service, dono do ciclo de vida da OS:
abrir OS → `CreateBudget` → aprovação do cliente → `RequestPayment` (Mercado Pago) →
`PaymentConfirmed` → `StartExecution` → diagnóstico/reparo → `ExecutionCompleted`.

Compensações conforme o que já foi efetivado: `CancelBudget`, `RefundPayment` (estorno no
Mercado Pago), `CancelExecution`, devolução das peças ao estoque e OS `CANCELADA`; timeouts
por etapa; compensação que falha deixa a saga `FAILED` e dispara alerta. Consistência garantida
por Transactional Outbox, Inbox (idempotência), lock otimista e DLQ.

Justificativa completa: [ADR 0009](adr/0009-saga-orquestrada.md) — fluxo linear com dono
natural (a OS), decisão de compensação centralizada e testável, rastreabilidade da trilha
completa em um endpoint, participantes desacoplados entre si, e timeouts por etapa.

## Justificativa da divisão e das tecnologias

- **Divisão** por bounded context, seguindo o enunciado: atendimento/OS, orçamento/cobrança,
  execução/produção ([ADR 0008](adr/0008-divisao-em-tres-microsservicos.md)).
- **PostgreSQL** no os-service: modelo relacional e transação ACID que sustenta o outbox;
  **DynamoDB** no billing e no exec-prod: acesso por chave da OS, documentos flexíveis,
  conditional writes, custo zero ocioso ([ADR 0011](adr/0011-postgresql-e-dynamodb.md)).
- **Amazon SQS**: gerenciado, sem pods no cluster, DLQ nativa, IAM por fila
  ([ADR 0010](adr/0010-amazon-sqs-para-mensageria.md)).
- **CI/CD** independente por repositório: testes (unitários, BDD, integração) com cobertura
  mínima de 80%, SonarQube Quality Gate, imagem no Docker Hub, Terraform do serviço e deploy
  automatizado no EKS, disparado manualmente para controle de custo ([ADR 0012](adr/0012-cd-manual-com-pipeline-automatizado.md)).

## Cobertura de testes

| Serviço | Statements | Branches | Functions | Lines | BDD |
|---|---|---|---|---|---|
| os-service | 94.64% | 86.07% | 95.18% | 95.80% | `saga-ordem-servico.feature` (fluxo completo + 5 compensações) |
| billing-service | 99.35% | 97.01% | 99.27% | 99.63% | `orcamento-pagamento.feature` |
| exec-prod-service | 98.99% | 95.26% | 99.05% | 99.44% | `fila-execucao.feature` |
