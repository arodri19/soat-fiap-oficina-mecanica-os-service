# ADR 0012: CD automático a cada merge, com guarda de infraestrutura

## Status
Aceito (Fase 4). Substitui parcialmente o ADR 0007 para os microsserviços.

## Contexto
A Fase 4 exige "deploy automatizado em ambiente Kubernetes" em pipelines independentes. O
ADR 0007 tornou todo CD manual porque a infraestrutura (EKS/RDS) é sob demanda — um merge
com o cluster desligado quebraria o pipeline.

## Decisão
Nos três microsserviços, o CD dispara **automaticamente** em todo push em `homologacao` e
`main` (que só recebem código via PR com o CI verde — branches protegidas):

1. Reexecuta o CI (testes, cobertura ≥ 80%, SonarQube) como *reusable workflow*;
2. Publica a imagem no Docker Hub (`:<sha>`, `:<branch>`, `:latest`);
3. **Verifica se o cluster EKS (e, no os-service, o RDS) existe.** Se existir: aplica o
   Terraform do serviço (filas/tabelas/IAM), os manifestos e aguarda o rollout + smoke test.
   Se não existir: termina com aviso, sem falhar e sem provisionar nada.

Os repositórios de infraestrutura (`infra-kube`, `infra-data`, `serverless`) continuam com
CD manual (ADR 0007): ligar a infraestrutura continua sendo uma decisão explícita.

## Consequências
- "PR mergeado = imagem publicada; e implantada se o ambiente estiver de pé."
- O controle de custo da Fase 3 é preservado.
