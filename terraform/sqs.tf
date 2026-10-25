locals {
  prefix = "${var.project_name}-${var.environment}"

  # Filas dos OUTROS serviços para onde o orquestrador envia comandos. Não são
  # criadas aqui (cada serviço é dono da fila que consome) — só referenciadas
  # por nome/ARN na policy de envio.
  billing_commands_queue   = "${local.prefix}-billing-commands"
  execution_commands_queue = "${local.prefix}-execution-commands"
}

# Fila de respostas da saga: billing-service e exec-prod-service publicam aqui
# (BudgetCreated, PaymentConfirmed, ExecutionCompleted, ...). Consumida só pelo
# orquestrador do os-service.
resource "aws_sqs_queue" "saga_replies_dlq" {
  name                      = "${local.prefix}-os-saga-replies-dlq"
  message_retention_seconds = 1209600 # 14 dias para investigar/reprocessar
}

resource "aws_sqs_queue" "saga_replies" {
  name                       = "${local.prefix}-os-saga-replies"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600 # 4 dias
  receive_wait_time_seconds  = 20     # long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.saga_replies_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "saga_replies_dlq" {
  queue_url = aws_sqs_queue.saga_replies_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.saga_replies.arn]
  })
}
