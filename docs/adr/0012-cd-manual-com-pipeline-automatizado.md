# ADR 0012: CD dos microsserviços disparado manualmente, pipeline 100% automatizado

## Status
Aceito (Fase 4). Estende o ADR 0007 (Fase 3) aos três microsserviços.

## Contexto
A Fase 4 pede "deploy automatizado em ambiente Kubernetes" em pipelines independentes. A
infraestrutura do projeto é sob demanda (EKS, RDS, NAT ficam desligados fora das janelas de
teste) e cada deploy com o cluster ligado cria recursos cobrados (LoadBalancer por serviço).
Um merge acidental não deveria implantar nada nem gerar custo.

## Decisão
- **CI automático** em todo push de branch de trabalho e em todo PR para `main`/`homologacao`
  (testes unitários, BDD e integração, cobertura ≥ 80%, SonarQube Quality Gate, build da imagem).
  `main` e `homologacao` são protegidas: merge só via PR com o CI verde.
- **CD disparado manualmente** (`workflow_dispatch`, *Run workflow*), escolhendo a branch e o
  ambiente — o mesmo modelo dos repositórios de infraestrutura. Nenhum push ou merge implanta
  sozinho.
- **Uma execução do CD é o pipeline completo, sem intervenção**: reexecuta o CI (reusable
  workflow) → publica a imagem no Docker Hub → aplica o Terraform do serviço (filas, tabelas,
  IAM) → `kubectl apply` → aguarda o rollout → smoke test. Se o cluster não existir, publica a
  imagem e termina com aviso, sem provisionar nada.
- **Destroy** próprio por serviço (remove Services/LoadBalancer e o Terraform do serviço), a
  ser rodado antes de derrubar o cluster.

## Justificativa
1. **Custo**: o "ligar" e o "implantar" continuam sendo decisões explícitas de uma pessoa.
2. **O deploy é automatizado**: não há passo manual de build, teste, `kubectl` ou Terraform —
   o que é manual é só o *gatilho*, e ele não pula a validação de testes (o CD sempre
   reexecuta o CI antes de publicar).
3. **Consistência** com os demais repositórios do projeto (ADR 0007).

## Consequências
- Diverge da leitura literal "deploy a cada merge"; virar automático é trivial: adicionar
  `push: branches: [main]` ao `on:` do `cd.yml` — nenhuma etapa do pipeline muda.
- O botão *Run workflow* só aparece quando o `cd.yml` está na branch padrão (`main`).
