# ADR 0010: Amazon SQS (com DLQ) para a mensageria da saga

## Status
Aceito (Fase 4).

## Decisão
Filas **SQS standard**, uma por consumidor (`*-billing-commands`, `*-execution-commands`,
`*-os-saga-replies`), cada uma com **DLQ** (`maxReceiveCount = 5`). Cada serviço cria a
fila que consome no próprio Terraform.

## Justificativa
- **Gerenciado e sem pods**: o cluster da Fase 3 é pequeno (custo); RabbitMQ/Kafka
  exigiriam StatefulSets, volumes e operação. SQS custa ~zero com o volume da oficina e
  combina com a infra sob demanda (ADR 0007).
- **At-least-once + DLQ nativos**: retry por *visibility timeout* e isolamento de mensagens
  problemáticas sem código extra. A idempotência fica a cargo dos serviços (inbox/conditional writes).
- **IAM de menor privilégio**: cada serviço só lê a própria fila e só publica nas filas
  de quem conversa com ele.
- **LocalStack** reproduz o SQS localmente (docker compose), com os mesmos nomes de fila.

## Consequências
- Sem ordenação garantida (FIFO não é necessário: o orquestrador valida a etapa esperada).
- Orquestração via comandos ponto a ponto; não há *fan-out* — se surgir necessidade de
  vários consumidores do mesmo evento, adicionar um tópico SNS na frente das filas.
