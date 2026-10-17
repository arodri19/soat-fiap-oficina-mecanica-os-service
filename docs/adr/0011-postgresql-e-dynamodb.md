# ADR 0011: PostgreSQL no os-service, DynamoDB no billing e no exec-prod

## Status
Aceito (Fase 4). Complementa o ADR 0001 (PostgreSQL).

## Decisão
| Serviço | Banco | Por quê |
|---|---|---|
| os-service | **PostgreSQL (RDS)** — relacional | Modelo fortemente relacional (cliente → veículo → OS → serviços → peças), integridade referencial, e a transação ACID local que sustenta o *Transactional Outbox* (OS + saga + mensagem na mesma transação). Reaproveita o RDS e a Lambda de CPF da Fase 3. |
| billing-service | **DynamoDB** — NoSQL | Acesso sempre por chave da OS: orçamento + pagamentos na mesma partição (`pk = ORDER#id`), lidos com uma única Query. *Conditional writes* dão criação única e lock otimista sem servidor de banco. Documento flexível para itens e histórico de status. |
| exec-prod-service | **DynamoDB** — NoSQL | Um documento por OS com a linha do tempo aninhada (diagnóstico, reparo, notas); fila por status via GSI (`STATUS#QUEUED` ordenado por `queuedAt`); índice esparso para o outbox. |

Atende ao requisito "ao menos um banco relacional e ao menos um não relacional", com cada
serviço dono do próprio banco.

## Consequências
- DynamoDB `PAY_PER_REQUEST`: custo zero sem tráfego, provisionado pelo Terraform de cada
  serviço; sem instância a mais para subir/derrubar.
- Sem joins entre serviços (por design) — consultas consolidadas são feitas por REST.
