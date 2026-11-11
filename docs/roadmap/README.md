# Roadmap

Planos de evolução do Sale Advisor, em passos sequenciais. Cada passo é uma issue: um PR pequeno
para o `master`, com testes escritos antes da implementação e commit ao concluir (`AGENTS.md`).

| Ordem | Plano                                                     | Issues        | Resultado                                                            |
| ----- | --------------------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| 1     | [Novas categorias de hardware](01-hardware-categories.md) | HW-01 a HW-14 | Processadores, memórias, SSDs/HDs, fontes e placas-mãe no app        |
| 2     | [Verificação ativa de preços](02-active-price-checks.md)  | AC-01 a AC-11 | Lista monitorada checada pela VPS e pelo PC, com IA local de reserva |

## Sequência

```text
HW-01 medição das fontes
  → HW-02 ADR 0009
    → HW-03 domínio → HW-04 banco → HW-05 preço e score
                                  → HW-06 API → HW-07 admin
                                              → HW-08 mobile
      → HW-09 processadores → HW-10 memórias → HW-11 SSDs/HDs → HW-12 fontes → HW-13 placas-mãe
        → HW-14 calibragem e release

HW-08 → AC-01 ADR 0010
  → AC-02 banco → AC-03 extratores → AC-06 runner → AC-07 IA local
               → AC-04 API interna → AC-05 agendador → AC-08 score e push
                                                    → AC-09 admin
    → AC-10 operação e medição → AC-11 pesquisa Pichau e Terabyte (futura)
```

O plano 2 pode começar depois da HW-08, em paralelo com as categorias HW-09 a HW-13.

## Como usar

- O status de cada plano fica no topo do arquivo. Um plano só é implementado depois de aprovado.
- Cada issue traz dependências, escopo, critérios de aceite e testes. O texto serve de corpo para
  uma issue do GitHub.
- Decisões de arquitetura não ficam aqui: cada plano começa por um ADR em `docs/adr`.
- Medições e resultados vão para `docs/reports`.
