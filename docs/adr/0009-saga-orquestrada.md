# ADR 0009: Saga orquestrada (os-service como orquestrador)

## Status
Aceito (Fase 4).

## Contexto
Criar OS → gerar orçamento → aprovar → pagar → executar envolve três bancos diferentes. Não
existe transação distribuída (2PC) entre PostgreSQL e DynamoDB, e mesmo se existisse ela
acoplaria a disponibilidade dos três serviços. O enunciado pede Saga com rollback e
compensação em qualquer etapa, orquestrada **ou** coreografada.

## Decisão
**Saga orquestrada**, com o orquestrador dentro do **os-service**.

## Justificativa
1. **O fluxo é linear e tem dono claro.** A OS é o agregado cujo ciclo de vida está sendo
   coordenado; o os-service já é a fonte da verdade do status. Colocar o orquestrador ali evita
   um quarto serviço só para coordenação.
2. **Compensação depende do estado global.** Decidir se a falha exige `CancelBudget`,
   `RefundPayment` e/ou `CancelExecution` depende do que *já* aconteceu nos outros serviços.
   Na orquestração esse estado está num único registro (`SagaInstance`) e a decisão é uma
   função pura e testável (`OrderSaga.startCompensation`). Na coreografia cada serviço teria
   que inferir isso a partir de eventos dos demais.
3. **Observabilidade e suporte.** "Em que etapa está a OS 42 e por quê falhou?" se responde
   com uma consulta (`GET /orders/42/history` mostra a trilha completa da saga). Na
   coreografia seria preciso reconstruir o fluxo a partir de logs de vários serviços.
4. **Participantes simples e desacoplados entre si.** billing e exec-prod não se conhecem;
   só respondem a comandos. Incluir uma nova etapa (ex.: reserva de box) altera o
   orquestrador, não todos os serviços.
5. **Timeouts.** Etapas paradas (cliente que nunca aprova, participante que não responde) são
   detectadas e compensadas pelo orquestrador — difícil de fazer sem um dono do fluxo.

## Trade-offs aceitos
- O os-service concentra a lógica do fluxo (mitigado: a lógica é domínio puro, isolada em
  `domain/saga` e `application/saga`, coberta por testes unitários e BDD).
- Ponto único de coordenação: mitigado por réplicas (HPA), *outbox* + *inbox* (nenhuma
  mensagem se perde ou é aplicada duas vezes) e lock otimista entre réplicas.

## Alternativa descartada
Coreografia por eventos (SNS + filas por serviço). Menos acoplamento central, mas com 5
etapas e 3 caminhos de compensação o fluxo ficaria implícito e espalhado, e a decisão de
compensação dependeria de estado replicado em cada serviço.
