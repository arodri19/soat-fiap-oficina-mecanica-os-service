# OS Service — Oficina Mecânica (Fase 4)

Microsserviço de **Ordem de Serviço** do Tech Challenge SOAT/FIAP — e **orquestrador da
Saga** que coordena orçamento, pagamento e execução entre os microsserviços.

| Microsserviço | Repositório | Banco |
|---|---|---|
| **OS Service** (este) | [soat-fiap-oficina-mecanica-os-service](https://github.com/arodri19/soat-fiap-oficina-mecanica-os-service) | PostgreSQL (RDS) |
| Billing Service | [soat-fiap-oficina-mecanica-billing-service](https://github.com/arodri19/soat-fiap-oficina-mecanica-billing-service) | DynamoDB |
| Execution & Production | [soat-fiap-oficina-mecanica-exec-prod](https://github.com/arodri19/soat-fiap-oficina-mecanica-exec-prod) | DynamoDB |

Infraestrutura compartilhada (Fase 3): [infra-kube](https://github.com/arodri19/soat-fiap-oficina-mecanica-infra-kube) (VPC, EKS, New Relic) ·
[infra-data](https://github.com/arodri19/soat-fiap-oficina-mecanica-infra-data) (RDS) ·
[serverless](https://github.com/arodri19/soat-fiap-oficina-mecanica-serverless) (login por CPF, API Gateway).

## Responsabilidades

- **Abertura da OS** com serviços e peças (preços do catálogo, reserva de estoque)
- **Atualização de status** — conduzida pela saga a partir das respostas do billing e do exec-prod
- **Consulta de status e histórico** (`/orders/:id/history`: transições + trilha da saga)
- Clientes PF/PJ, veículos, catálogo de serviços/peças, login de funcionários (JWT)
- Acompanhamento e aprovação/recusa do orçamento pelo cliente (`/track`, JWT por CPF)
- **Orquestração da saga** (Transactional Outbox, Inbox, timeouts, compensações)

## Saga Pattern — estratégia escolhida: **orquestração**

O fluxo transacional da OS é coordenado por um orquestrador central dentro deste serviço:

```
abrir OS ─► CreateBudget ─► BudgetCreated ─► [cliente aprova] ─► RequestPayment ─► (Mercado Pago)
        ─► PaymentConfirmed ─► StartExecution ─► ExecutionQueued ─► ... ─► ExecutionCompleted ─► FINALIZADA
```

Falha em qualquer etapa dispara as **compensações** do que já foi efetivado — `CancelBudget`,
`RefundPayment` (estorno no Mercado Pago), `CancelExecution` — além da devolução das peças ao
estoque e do cancelamento da OS. Etapas paradas além do limite também são compensadas (timeout).

**Por que orquestração e não coreografia** (detalhes no [ADR 0009](docs/adr/0009-saga-orquestrada.md)):

1. O fluxo é linear e tem um dono natural — a OS; o os-service já é a fonte da verdade do status.
2. A decisão de *quais* compensações executar depende do estado global da OS (orçamento criado?
   pagamento confirmado? execução na fila?). Com orquestração esse estado está num único registro
   (`SagaInstance`) e a decisão é uma função pura e testada (`OrderSaga.startCompensation`).
3. Rastreabilidade: a trilha completa (comandos, respostas, compensações) é consultável em um
   endpoint, em vez de reconstruída a partir de eventos espalhados por três serviços.
4. Participantes simples: billing e exec-prod não se conhecem, só respondem a comandos.
5. Timeouts por etapa só são viáveis com um dono do fluxo.

Garantias: **outbox** (OS + saga + comando na mesma transação PostgreSQL), **inbox**
(mensagem processada uma única vez), **lock otimista** entre réplicas, **DLQ** por fila.

📐 Arquitetura completa, diagramas e tabela de compensações: [docs/arquitetura.md](docs/arquitetura.md) ·
contratos das mensagens: [docs/mensageria.md](docs/mensageria.md) · ADRs: [docs/adr](docs/adr).

## Arquitetura do serviço (Clean Architecture)

```
src/
├── domain/
│   ├── entities/Order.js              ← OS (máquina de estados)
│   ├── saga/OrderSaga.js              ← estado da saga + planejamento de compensações (puro)
│   └── value-objects/OrderStatus.js   ← 9 status, transições válidas
├── application/
│   ├── saga/OrderSagaOrchestrator.js  ← orquestrador (comandos, respostas, timeouts)
│   ├── messaging/contracts.js         ← tipos e envelope das mensagens
│   ├── use-cases/OrderUseCases.js     ← abrir, listar, histórico, entregar, progresso...
│   └── services/                      ← fachadas usadas pelos controllers
├── infrastructure/
│   ├── repositories/                  ← Prisma (OS, saga, outbox, inbox, catálogo) + Unit of Work
│   ├── messaging/                     ← SqsMessageBus, OutboxRelay, SagaReplyConsumer
│   ├── http/                          ← clientes REST internos + circuit breaker
│   └── monitoring/                    ← New Relic (eventos + distributed tracing)
├── controllers/ · routes/ · middlewares/
└── openapi.json                       ← Swagger (/api-docs)
```

API, relay do outbox, consumidor da fila de respostas e verificação de timeouts rodam no mesmo
processo/Deployment (várias réplicas são seguras: `SKIP LOCKED`, inbox e lock otimista).

### Status da OS

`RECEBIDA → AGUARDANDO_APROVACAO → AGUARDANDO_PAGAMENTO → AGUARDANDO_EXECUCAO → EM_DIAGNOSTICO → EM_EXECUCAO → FINALIZADA → ENTREGUE`
— e `CANCELADA` a partir de qualquer etapa anterior à finalização (compensação).

## API (Swagger em `/api-docs`)

| Método | Rota | Quem | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | público | Login de funcionário (JWT) |
| POST | `/api/orders` | staff | **Abre a OS e inicia a saga** |
| GET | `/api/orders` | staff | OS ativas por prioridade (paginado) |
| GET | `/api/orders/:id` | staff | OS + resumo da saga |
| GET | `/api/orders/:id/history` | staff | Histórico de status + trilha da saga |
| GET | `/api/orders/:id/progress` | staff | Visão consolidada (REST síncrono no billing/exec-prod) |
| POST | `/api/orders/:id/cancel` | staff | Cancela → compensações |
| POST | `/api/orders/:id/deliver` | staff | FINALIZADA → ENTREGUE |
| GET | `/api/track/:externalId` | cliente | Status + link de pagamento Mercado Pago |
| POST | `/api/track/:externalId/approve` | cliente | Aprova o orçamento → cobrança |
| POST | `/api/track/:externalId/reject` | cliente | Recusa → compensação |
| CRUD | `/api/clients/pf`, `/api/clients/pj`, `/api/vehicles`, `/api/services`, `/api/parts` | staff | Cadastros |

Coleções prontas (REST Client do VS Code): [`requests/`](requests) — o roteiro completo da
saga com os 3 serviços está em [`requests/00-fase04-saga.http`](requests/00-fase04-saga.http).

## Executando localmente (os 3 microsserviços)

Pré-requisito: os três repositórios clonados lado a lado (o `docker-compose.yml` deste
repositório builda o billing e o exec-prod a partir das pastas vizinhas).

```bash
docker compose up --build          # Postgres + LocalStack (SQS/DynamoDB) + 3 serviços
# porta 5432 ocupada? DB_HOST_PORT=55432 docker compose up --build

./scripts/e2e-saga.sh              # fluxo feliz + 3 cenários de compensação, ponta a ponta
```

- os-service: http://localhost:4000/api-docs · billing: http://localhost:4100/api-docs · exec-prod: http://localhost:4200/api-docs
- Login: `admin@oficina.com` / `Admin123!` · token de cliente local: `node scripts/client-token.js 1`
- Sem credenciais do Mercado Pago o billing usa o gateway **fake** (pagamento simulado em
  `POST /api/payments/order/:id/simulate`). Com credenciais de teste:
  `PAYMENT_GATEWAY=mercadopago MERCADOPAGO_ACCESS_TOKEN=<token de teste> docker compose up`.

## Testes e qualidade

| Tipo | Onde | Comando |
|---|---|---|
| Unitários | `tests/unit` (domínio, orquestrador, use cases, controllers, adaptadores) | `npm run test:unit` |
| **BDD** (fluxo completo da saga) | [`tests/bdd/features/saga-ordem-servico.feature`](tests/bdd/features/saga-ordem-servico.feature) | `npm run test:bdd` |
| Integração (PostgreSQL real) | `tests/integration/saga.prisma.test.js` | `RUN_DB_TESTS=true npm run test:integration` |
| Ponta a ponta (3 serviços) | `scripts/e2e-saga.sh` | com `docker compose up` |

O cenário BDD cobre o fluxo completo (abertura → orçamento → aprovação → pagamento → fila →
diagnóstico → reparo → finalização → entrega) e as compensações: recusa do orçamento, pagamento
recusado, oficina lotada após o pagamento (estorno), falha no reparo (estorno) e estorno recusado
(saga `FAILED`).

### Evidência de cobertura (mínimo exigido: 80% — o CI falha abaixo disso)

```
Statements   : 94.64% ( 1574/1663 )
Branches     : 86.07% ( 612/711 )
Functions    : 95.18% ( 356/374 )
Lines        : 95.8%  ( 1462/1526 )
Test Suites: 34 passed · Tests: 347 passed
```

O relatório HTML é publicado como artefato (`coverage-os-service`) em cada execução do CI, e o
resumo aparece no *job summary*. A análise estática e o Quality Gate rodam no **SonarQube/SonarCloud**
(`sonar-project.properties`, step "Análise SonarQube + Quality Gate").

## CI/CD

| Workflow | Gatilho | Etapas |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | push em branches de trabalho, PR para `main`/`homologacao` | `npm ci` → migrations num PostgreSQL de serviço → testes unitários + BDD + integração com **cobertura ≥ 80%** → **SonarQube Quality Gate** → build da imagem |
| [`cd.yml`](.github/workflows/cd.yml) | **manual** (*Run workflow*, escolhendo branch e ambiente) | CI completo → push da imagem no Docker Hub → Terraform do serviço (fila SQS + DLQ + IAM) → `kubectl apply` + rollout + seed (banco vazio) + smoke test |

Se o cluster EKS estiver desligado (infra sob demanda da Fase 3), o CD publica a imagem e pula
o deploy com aviso. O gatilho é manual, igual aos repositórios de infra, para nenhum merge gerar
custo sem querer — mas a execução é o pipeline completo, sem passos manuais
([ADR 0012](docs/adr/0012-cd-manual-com-pipeline-automatizado.md)).

**Branches protegidas**: `main` e `homologacao` exigem PR com os checks
"Testes + Cobertura + SonarQube" e "Build da imagem Docker" verdes (Settings → Branches →
*Require a pull request* + *Require status checks to pass*). O trabalho da fase acontece na
branch `fase04`.

Secrets/variables usados: ver o cabeçalho de [`cd.yml`](.github/workflows/cd.yml).

## Infraestrutura deste serviço

- [`terraform/`](terraform) — fila `*-os-saga-replies` + DLQ e policy IAM (consumir a própria fila,
  publicar nas filas de comando do billing/exec-prod), anexada ao role dos nodes do EKS
  (lido do state do `infra-kube`). O RDS continua no `infra-data`.
- [`k8s/`](k8s) — ConfigMap, Deployment (initContainer `prisma migrate deploy`), Service
  público (LoadBalancer) + interno (ClusterIP), HPA, metrics-server.

## Observabilidade

New Relic APM (`oficina-os-service`) com **distributed tracing através do SQS**, logs estruturados
(pino) com `sagaId`/`correlationId`, eventos `Saga*` e `OrderStatusChanged`, dashboard
"Saga e Microsserviços" e alertas (`SagaFailed`, pico de compensações) no `infra-kube`.
