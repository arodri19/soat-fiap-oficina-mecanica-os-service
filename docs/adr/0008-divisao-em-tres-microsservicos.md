# ADR 0008: Divisão do monólito em três microsserviços

## Status
Aceito (Fase 4).

## Contexto
A oficina passou a operar com várias filiais. Atendimento, orçamento/cobrança e execução
têm ritmos, picos e dependências externas diferentes (o Mercado Pago só afeta a cobrança;
a fila de execução cresce com o número de mecânicos). No monólito, uma falha ou um deploy em
qualquer área derrubava todas.

## Decisão
Separar por *bounded context*, seguindo os exemplos do enunciado:

| Serviço | Contexto | Dados que possui |
|---|---|---|
| **os-service** | Atendimento / ciclo de vida da OS | clientes, veículos, catálogo e estoque, OS, histórico, saga |
| **billing-service** | Orçamento e cobrança | orçamentos, pagamentos (Mercado Pago) |
| **exec-prod-service** | Produção | fila de execução, diagnóstico, reparo |

Catálogo e estoque ficam no os-service porque o preço e a reserva de peças acontecem no
momento da abertura (mesma transação da OS). O orçamento leva um *snapshot* dos preços —
o billing não consulta o catálogo.

## Consequências
- Deploy, escala (HPA) e falha isolados por serviço; o Mercado Pago fora do ar não impede
  abrir OS nem executar as já pagas.
- Consistência passa a ser eventual entre serviços → exige a saga (ADR 0009).
- Três pipelines, três imagens e três conjuntos de manifestos para manter.
