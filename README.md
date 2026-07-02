# Sale Advisor

Monorepo para um app de monitoramento de promoções. O MVP foca em placas de vídeo e usa grupos de Telegram como fonte inicial de ofertas.

## Estrutura

```text
apps/api      Backend HTTP
apps/worker   Coleta, parsing, dedupe, scoring e notificações
apps/mobile   App mobile
apps/admin    Painel interno
packages      Código compartilhado
infra         Infraestrutura e deploy
docs          Documentação e decisões arquiteturais
```

As decisões técnicas e práticas de desenvolvimento do projeto estão em `AGENTS.md`.
