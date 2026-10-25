# Contratos de mensagens da saga (SQS)

Filas (prefixo `<projeto>-<ambiente>`, ex. `oficina-mecanica-dev`), cada uma com DLQ `*-dlq`:

| Fila | Dono (Terraform / consumidor) | Produtores |
|---|---|---|
| `*-billing-commands` | billing-service | os-service (orquestrador) |
| `*-execution-commands` | exec-prod-service | os-service (orquestrador) |
| `*-os-saga-replies` | os-service | billing-service, exec-prod-service |

Cada repositório mantém sua cópia do contrato (`contracts.js`) — não há biblioteca
compartilhada, para que os deploys continuem independentes. Mudanças de contrato devem ser
**aditivas** (novos campos opcionais) para não exigir deploy coordenado.

## Envelope

```jsonc
{
  "messageId": "b0b1c6d2-...",        // idempotência (Inbox / dedupe)
  "type": "CreateBudget",
  "sagaId": "6c2e3605-...",           // instância da saga
  "orderId": 42,
  "correlationId": "6c2e3605-...",    // = sagaId; aparece em todos os logs
  "source": "os-service",
  "replyTo": "oficina-mecanica-dev-os-saga-replies",
  "occurredAt": "2026-10-17T19:42:17.390Z",
  "traceHeaders": { "traceparent": "00-...", "newrelic": "..." },  // Distributed Tracing
  "payload": { }
}
```

## Comandos → billing-service

| Tipo | Payload | Respostas |
|---|---|---|
| `CreateBudget` | `externalId`, `customer {name,email}`, `items[] {type: SERVICE\|PART, referenceId, description, quantity, unitPrice}` | `BudgetCreated {budgetId, total, status}` · `BudgetCreationFailed {reason}` |
| `RequestPayment` | `externalId`, `payer {name,email}` | `PaymentRequested {paymentId, checkoutUrl, amount}` · `PaymentRequestFailed {reason}` |
| `CancelBudget` *(compensação)* | `reason`, `budgetId` | `BudgetCancelled {budgetId}` |
| `RefundPayment` *(compensação)* | `reason`, `paymentId` | `PaymentRefunded {paymentId, amount}` · `PaymentRefundFailed {reason}` |

Eventos assíncronos do billing (originados no webhook do Mercado Pago):
`PaymentConfirmed {paymentId, providerPaymentId, amount}` · `PaymentFailed {paymentId, providerStatus, reason}`.

## Comandos → exec-prod-service

| Tipo | Payload | Respostas |
|---|---|---|
| `StartExecution` | `externalId`, `description`, `vehicle {plate, model}`, `services[] {serviceId, name, slaMinutes, parts[]}` | `ExecutionQueued {executionId, queuePosition, estimatedMinutes}` · `ExecutionRejected {reason}` |
| `CancelExecution` *(compensação)* | `reason` | `ExecutionCancelled {status}` |

Eventos do exec-prod (ações do mecânico):
`ExecutionStatusChanged {status: DIAGNOSING\|REPAIRING, mechanicName, notes}` ·
`ExecutionCompleted {notes, finishedAt, mechanicName}` · `ExecutionFailed {reason}`.

## Semântica de entrega

- **At-least-once**: a mensagem só é apagada após o handler concluir; erro → reentrega após o
  *visibility timeout*; após 5 tentativas → DLQ.
- **Idempotência**: o orquestrador registra `messageId` no Inbox na mesma transação da
  mudança de estado; participantes usam *conditional writes* (criação única por `orderId`) e
  respondem de novo com o mesmo resultado quando o comando é reentregue.
- **Ordem**: filas *standard* não garantem ordem; o orquestrador ignora respostas fora da etapa
  esperada (`IGNORED_OUT_OF_ORDER`) e aceita, por exemplo, um `ExecutionStatusChanged` que
  chegue antes do `ExecutionQueued` (a mudança de status já prova que a OS entrou na fila).
