locals {
  queue_arn_prefix = "arn:aws:sqs:${var.aws_region}:${data.aws_caller_identity.current.account_id}"
}

# Menor privilégio: o os-service CONSOME só a própria fila de respostas e
# PUBLICA só nas filas de comando do billing e do exec-prod.
data "aws_iam_policy_document" "os_service" {
  statement {
    sid = "ConsumeSagaReplies"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:ChangeMessageVisibility",
      "sqs:GetQueueUrl",
      "sqs:GetQueueAttributes"
    ]
    resources = [aws_sqs_queue.saga_replies.arn]
  }

  statement {
    sid     = "SendSagaCommands"
    actions = ["sqs:SendMessage", "sqs:GetQueueUrl"]
    resources = [
      "${local.queue_arn_prefix}:${local.billing_commands_queue}",
      "${local.queue_arn_prefix}:${local.execution_commands_queue}"
    ]
  }
}

resource "aws_iam_policy" "os_service" {
  name        = "${local.prefix}-os-service-messaging"
  description = "Acesso do os-service às filas SQS da saga"
  policy      = data.aws_iam_policy_document.os_service.json
}

resource "aws_iam_role_policy_attachment" "os_service_nodes" {
  role       = data.terraform_remote_state.infra_kube.outputs.node_role_name
  policy_arn = aws_iam_policy.os_service.arn
}
