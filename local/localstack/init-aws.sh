#!/bin/sh
# Executado pelo LocalStack quando fica pronto (/etc/localstack/init/ready.d).
# Cria as mesmas filas SQS (com DLQ) e tabelas DynamoDB que o Terraform de cada
# microsserviço cria na AWS — nomes idênticos, prefixo "oficina-mecanica-dev".
set -eu

PREFIX="${QUEUE_PREFIX:-oficina-mecanica-dev}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

create_queue() {
  name="$1"
  awslocal sqs create-queue --region "$REGION" --queue-name "${name}-dlq" >/dev/null
  dlq_arn=$(awslocal sqs get-queue-attributes --region "$REGION" \
    --queue-url "http://sqs.${REGION}.localhost.localstack.cloud:4566/000000000000/${name}-dlq" \
    --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)
  awslocal sqs create-queue --region "$REGION" --queue-name "$name" \
    --attributes "{\"VisibilityTimeout\":\"30\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"${dlq_arn}\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"}" >/dev/null
  echo "fila criada: ${name} (+ DLQ)"
}

create_queue "${PREFIX}-os-saga-replies"
create_queue "${PREFIX}-billing-commands"
create_queue "${PREFIX}-execution-commands"

awslocal dynamodb create-table --region "$REGION" \
  --table-name "${PREFIX}-billing" \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
                          AttributeName=gsi1pk,AttributeType=S AttributeName=gsi1sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes '[{"IndexName":"gsi1","KeySchema":[{"AttributeName":"gsi1pk","KeyType":"HASH"},{"AttributeName":"gsi1sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]' \
  >/dev/null
echo "tabela criada: ${PREFIX}-billing"

awslocal dynamodb create-table --region "$REGION" \
  --table-name "${PREFIX}-executions" \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions AttributeName=pk,AttributeType=S \
                          AttributeName=gsi1pk,AttributeType=S AttributeName=gsi1sk,AttributeType=S \
                          AttributeName=gsi2pk,AttributeType=S AttributeName=gsi2sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --global-secondary-indexes '[{"IndexName":"gsi1","KeySchema":[{"AttributeName":"gsi1pk","KeyType":"HASH"},{"AttributeName":"gsi1sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"gsi2","KeySchema":[{"AttributeName":"gsi2pk","KeyType":"HASH"},{"AttributeName":"gsi2sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]' \
  >/dev/null
echo "tabela criada: ${PREFIX}-executions"
