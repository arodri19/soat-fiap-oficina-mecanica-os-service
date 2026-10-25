#!/usr/bin/env bash
# Teste ponta a ponta da saga com os 3 microsserviços REAIS (docker compose up).
# Também serve de roteiro para o vídeo de demonstração.
#
#   ./scripts/e2e-saga.sh             # todos os cenários
#   OS_URL=http://<lb-os> BILLING_URL=http://<lb-billing> EXEC_URL=http://<lb-exec> ./scripts/e2e-saga.sh
#
# Cenários: fluxo feliz | recusa do orçamento | pagamento recusado | falha no reparo (estorno)
# Requer: curl, jq, node (para gerar o token de cliente).
set -euo pipefail

OS_URL="${OS_URL:-http://localhost:4000}/api"
BILLING_URL="${BILLING_URL:-http://localhost:4100}/api"
EXEC_URL="${EXEC_URL:-http://localhost:4200}/api"
JWT_SECRET="${JWT_SECRET:-super-secret-change-me}"
CLIENT_ID="${CLIENT_ID:-1}"
VEHICLE_ID="${VEHICLE_ID:-1}"

cd "$(dirname "$0")/.."
bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✘ %s\033[0m\n' "$*"; exit 1; }

STAFF=$(curl -sf -X POST "$OS_URL/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@oficina.com","password":"Admin123!"}' | jq -r .token)
CLIENT=$(JWT_SECRET="$JWT_SECRET" node scripts/client-token.js "$CLIENT_ID")
[ -n "$STAFF" ] && [ "$STAFF" != null ] || fail "login do atendente falhou"

api() { # api <método> <url> <token> [json]
  curl -sf -X "$1" "$2" -H "Authorization: Bearer $3" -H 'Content-Type: application/json' ${4:+-d "$4"}
}

# Espera (até 30s) a OS chegar no status esperado — a saga é assíncrona (SQS)
wait_status() { # wait_status <orderId> <status>
  for _ in $(seq 1 60); do
    current=$(api GET "$OS_URL/orders/$1" "$STAFF" | jq -r .status)
    [ "$current" = "$2" ] && { ok "OS $1 → $2"; return 0; }
    sleep 0.5
  done
  fail "OS $1 ficou em $current (esperado $2)"
}

wait_payment() { # wait_payment <orderId> — espera a cobrança (RequestPayment) existir no billing
  for _ in $(seq 1 60); do
    count=$( (api GET "$BILLING_URL/payments/order/$1" "$STAFF" 2>/dev/null || echo '[]') | jq 'map(select(.status == "PENDING")) | length')
    [ "$count" -gt 0 ] && return 0
    sleep 0.5
  done
  fail "cobrança da OS $1 não foi criada"
}

wait_saga() { # wait_saga <orderId> <sagaStatus>
  for _ in $(seq 1 60); do
    current=$(api GET "$OS_URL/orders/$1" "$STAFF" | jq -r .saga.status)
    [ "$current" = "$2" ] && { ok "saga da OS $1 → $2"; return 0; }
    sleep 0.5
  done
  fail "saga da OS $1 ficou em $current (esperado $2)"
}

open_order() {
  api POST "$OS_URL/orders" "$STAFF" "{\"description\":\"$1\",\"clientPFId\":$CLIENT_ID,\"vehicleId\":$VEHICLE_ID,\"services\":[{\"serviceId\":1,\"parts\":[{\"partId\":1,\"quantity\":1},{\"partId\":2,\"quantity\":1}]}]}"
}

# ── 1. Fluxo feliz ─────────────────────────────────────────────────────────────
bold "1) Fluxo completo: abertura → orçamento → aprovação → pagamento → execução → entrega"
ORDER=$(open_order "E2E fluxo feliz")
ID=$(jq -r .id <<<"$ORDER"); EXT=$(jq -r .externalId <<<"$ORDER")
ok "OS $ID aberta (saga $(jq -r .saga.id <<<"$ORDER"))"
wait_status "$ID" AGUARDANDO_APROVACAO
ok "orçamento no billing: R\$ $(api GET "$BILLING_URL/budgets/order/$ID" "$STAFF" | jq -r .total)"
api POST "$OS_URL/track/$EXT/approve" "$CLIENT" >/dev/null && ok "cliente aprovou"
wait_status "$ID" AGUARDANDO_PAGAMENTO
for _ in $(seq 1 30); do
  URL=$(api GET "$OS_URL/track/$EXT" "$CLIENT" | jq -r '.saga.paymentUrl // empty'); [ -n "$URL" ] && break; sleep 0.5
done
ok "link de pagamento: $URL"
wait_payment "$ID"
api POST "$BILLING_URL/payments/order/$ID/simulate" "$STAFF" '{"status":"approved"}' >/dev/null && ok "pagamento aprovado (webhook simulado)"
wait_status "$ID" AGUARDANDO_EXECUCAO
for _ in $(seq 1 30); do api GET "$EXEC_URL/executions/$ID" "$STAFF" >/dev/null 2>&1 && break; sleep 0.5; done
ok "OS na fila do exec-prod: $(api GET "$EXEC_URL/executions/$ID" "$STAFF" | jq -r .status)"
api POST "$EXEC_URL/executions/$ID/diagnosis/start" "$STAFF" '{"mechanicName":"Roberto"}' >/dev/null
wait_status "$ID" EM_DIAGNOSTICO
api POST "$EXEC_URL/executions/$ID/repair/start" "$STAFF" '{"diagnosisNotes":"filtro saturado"}' >/dev/null
wait_status "$ID" EM_EXECUCAO
api POST "$EXEC_URL/executions/$ID/complete" "$STAFF" '{"notes":"teste de rodagem ok"}' >/dev/null
wait_status "$ID" FINALIZADA
wait_saga "$ID" COMPLETED
api POST "$OS_URL/orders/$ID/deliver" "$STAFF" >/dev/null && wait_status "$ID" ENTREGUE
ok "visão consolidada (REST síncrono): billing=$(api GET "$OS_URL/orders/$ID/progress" "$STAFF" | jq -c '{b: .billing.data.payment.status, e: .execution.data.status}')"

# ── 2. Cliente recusa ──────────────────────────────────────────────────────────
bold "2) Compensação: cliente recusa o orçamento"
ORDER=$(open_order "E2E recusa"); ID=$(jq -r .id <<<"$ORDER"); EXT=$(jq -r .externalId <<<"$ORDER")
wait_status "$ID" AGUARDANDO_APROVACAO
api POST "$OS_URL/track/$EXT/reject" "$CLIENT" '{"reason":"caro demais"}' >/dev/null && ok "cliente recusou"
wait_status "$ID" CANCELADA
wait_saga "$ID" COMPENSATED
ok "orçamento no billing: $(api GET "$BILLING_URL/budgets/order/$ID" "$STAFF" | jq -r .status)"

# ── 3. Pagamento recusado ──────────────────────────────────────────────────────
bold "3) Compensação: Mercado Pago recusa o pagamento"
ORDER=$(open_order "E2E pagamento recusado"); ID=$(jq -r .id <<<"$ORDER"); EXT=$(jq -r .externalId <<<"$ORDER")
wait_status "$ID" AGUARDANDO_APROVACAO
api POST "$OS_URL/track/$EXT/approve" "$CLIENT" >/dev/null
wait_payment "$ID"
api POST "$BILLING_URL/payments/order/$ID/simulate" "$STAFF" '{"status":"rejected"}' >/dev/null && ok "pagamento recusado"
wait_status "$ID" CANCELADA
wait_saga "$ID" COMPENSATED

# ── 4. Falha na execução → estorno ─────────────────────────────────────────────
bold "4) Compensação: falha durante o reparo → estorno do pagamento"
ORDER=$(open_order "E2E falha no reparo"); ID=$(jq -r .id <<<"$ORDER"); EXT=$(jq -r .externalId <<<"$ORDER")
wait_status "$ID" AGUARDANDO_APROVACAO
api POST "$OS_URL/track/$EXT/approve" "$CLIENT" >/dev/null
wait_payment "$ID"
api POST "$BILLING_URL/payments/order/$ID/simulate" "$STAFF" '{"status":"approved"}' >/dev/null
wait_status "$ID" AGUARDANDO_EXECUCAO
for _ in $(seq 1 30); do api GET "$EXEC_URL/executions/$ID" "$STAFF" >/dev/null 2>&1 && break; sleep 0.5; done
api POST "$EXEC_URL/executions/$ID/diagnosis/start" "$STAFF" '{"mechanicName":"Ana"}' >/dev/null
api POST "$EXEC_URL/executions/$ID/fail" "$STAFF" '{"reason":"peça incompatível"}' >/dev/null && ok "mecânico reportou falha"
wait_status "$ID" CANCELADA
wait_saga "$ID" COMPENSATED
ok "pagamento no billing: $(api GET "$BILLING_URL/payments/order/$ID" "$STAFF" | jq -r '.[0].status')"

bold "Trilha da saga da última OS:"
api GET "$OS_URL/orders/$ID/history" "$STAFF" | jq -r '.saga.events[] | "  \(.kind)\t\(.type)"'
bold "Todos os cenários passaram ✔"
