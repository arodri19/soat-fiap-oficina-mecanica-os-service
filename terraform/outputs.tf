output "saga_replies_queue_url" {
  description = "URL da fila de respostas da saga"
  value       = aws_sqs_queue.saga_replies.id
}

output "saga_replies_dlq_url" {
  description = "URL da DLQ (mensagens que falharam 5x)"
  value       = aws_sqs_queue.saga_replies_dlq.id
}

output "queue_prefix" {
  description = "Prefixo das filas — valor do QUEUE_PREFIX no ConfigMap"
  value       = local.prefix
}
