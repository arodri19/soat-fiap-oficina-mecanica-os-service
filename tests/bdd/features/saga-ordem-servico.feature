# language: pt
Funcionalidade: Saga orquestrada da ordem de serviço
  Como oficina com várias filiais
  Quero que abertura, orçamento, aprovação, pagamento e execução de uma OS
  sejam coordenados entre os microsserviços com compensação em caso de falha
  Para nunca ficar com OS, orçamento ou pagamento em estados inconsistentes

  Contexto:
    Dado que o cliente "João Silva" possui o veículo de placa "ABC1D23"
    E que o catálogo possui o serviço "Troca de Óleo" com a peça "Óleo de Motor 5W40" em estoque

  Cenário: Fluxo completo de uma OS passando por todos os microsserviços
    Quando o atendente abre uma OS de "Troca de Óleo" com 2 unidades de "Óleo de Motor 5W40"
    Então a OS deve estar com status "RECEBIDA"
    E o comando "CreateBudget" deve ser enviado ao billing-service com total de 170.00
    Quando o billing-service confirma o orçamento
    Então a OS deve estar com status "AGUARDANDO_APROVACAO"
    Quando o cliente aprova o orçamento
    Então a OS deve estar com status "AGUARDANDO_PAGAMENTO"
    E o comando "RequestPayment" deve ser enviado ao billing-service
    Quando o billing-service gera o link de pagamento do Mercado Pago
    E o Mercado Pago confirma o pagamento
    Então a OS deve estar com status "AGUARDANDO_EXECUCAO"
    E o comando "StartExecution" deve ser enviado ao exec-prod-service
    Quando o exec-prod-service coloca a OS na fila de execução
    E o mecânico inicia o diagnóstico
    E o mecânico inicia o reparo
    E o mecânico finaliza o serviço
    Então a OS deve estar com status "FINALIZADA"
    E a saga deve estar "COMPLETED"
    Quando o atendente entrega o veículo
    Então a OS deve estar com status "ENTREGUE"
    E o histórico da OS deve conter as transições "RECEBIDA > AGUARDANDO_APROVACAO > AGUARDANDO_PAGAMENTO > AGUARDANDO_EXECUCAO > EM_DIAGNOSTICO > EM_EXECUCAO > FINALIZADA > ENTREGUE"

  Cenário: Cliente recusa o orçamento e a saga compensa
    Quando o atendente abre uma OS de "Troca de Óleo" com 2 unidades de "Óleo de Motor 5W40"
    E o billing-service confirma o orçamento
    E o cliente recusa o orçamento
    Então a OS deve estar com status "CANCELADA"
    E o comando de compensação "CancelBudget" deve ser enviado ao billing-service
    E o estoque de "Óleo de Motor 5W40" deve voltar ao valor original
    Quando o billing-service confirma o cancelamento do orçamento
    Então a saga deve estar "COMPENSATED"

  Cenário: Pagamento recusado pelo Mercado Pago dispara compensação
    Quando o atendente abre uma OS de "Troca de Óleo" com 2 unidades de "Óleo de Motor 5W40"
    E o billing-service confirma o orçamento
    E o cliente aprova o orçamento
    E o Mercado Pago recusa o pagamento
    Então a OS deve estar com status "CANCELADA"
    E o comando de compensação "CancelBudget" deve ser enviado ao billing-service
    Quando o billing-service confirma o cancelamento do orçamento
    Então a saga deve estar "COMPENSATED"

  Cenário: Execução recusada após o pagamento estorna o cliente
    Quando o atendente abre uma OS de "Troca de Óleo" com 2 unidades de "Óleo de Motor 5W40"
    E o billing-service confirma o orçamento
    E o cliente aprova o orçamento
    E o Mercado Pago confirma o pagamento
    E o exec-prod-service recusa a OS por falta de capacidade
    Então a OS deve estar com status "CANCELADA"
    E o comando de compensação "RefundPayment" deve ser enviado ao billing-service
    Quando o billing-service confirma o estorno do pagamento
    Então a saga deve estar "COMPENSATED"

  Cenário: Falha durante o reparo estorna o pagamento
    Quando o atendente abre uma OS de "Troca de Óleo" com 2 unidades de "Óleo de Motor 5W40"
    E o billing-service confirma o orçamento
    E o cliente aprova o orçamento
    E o Mercado Pago confirma o pagamento
    E o exec-prod-service coloca a OS na fila de execução
    E o mecânico inicia o diagnóstico
    E o mecânico reporta falha "peça incompatível com o veículo"
    Então a OS deve estar com status "CANCELADA"
    E o comando de compensação "RefundPayment" deve ser enviado ao billing-service
    Quando o billing-service confirma o estorno do pagamento
    Então a saga deve estar "COMPENSATED"

  Cenário: Estorno recusado deixa a saga em FAILED para tratamento manual
    Quando o atendente abre uma OS de "Troca de Óleo" com 2 unidades de "Óleo de Motor 5W40"
    E o billing-service confirma o orçamento
    E o cliente aprova o orçamento
    E o Mercado Pago confirma o pagamento
    E o exec-prod-service recusa a OS por falta de capacidade
    E o Mercado Pago recusa o estorno
    Então a saga deve estar "FAILED"
