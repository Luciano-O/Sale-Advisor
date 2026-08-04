# ADR 0005: resolução segura de URLs e reprocessamento versionado

- Status: aceita
- Data: 2026-08-03

## Contexto

Mensagens reais usam `aoferta.net`, `s.shopee.com.br` e `meli.la`. Consolidar o domínio do
encurtador cria ofertas incorretas, mas seguir redirects sem controles transforma o worker em um
vetor de SSRF. Melhorias do parser também precisam corrigir associações sem apagar a evidência
anterior.

## Decisão

Inserir a fila `resolve-url` entre outbox e `parse`. Somente os três encurtadores observados causam
acesso HTTP; URLs diretas seguem para o parser sem fetch. Cada salto:

- aceita apenas HTTP/HTTPS e rejeita credenciais na URL;
- resolve A/AAAA e rejeita qualquer resposta privada, local, link-local, multicast, reservada ou de
  metadata;
- conecta ao IP já validado, preservando `Host` e SNI, para evitar uma segunda resolução sujeita a
  DNS rebinding;
- segue redirects manualmente, revalidando URL e DNS, até cinco redirects;
- usa timeout de cinco segundos e encerra a resposta acima de 64 KB;
- não envia cookies nem headers de autenticação;
- repete somente rede, 408, 429 e 5xx.

O desenho segue a defesa em profundidade e a recomendação de desabilitar redirects automáticos da
[OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

Sucessos de encurtadores ficam em cache por sete dias. Toda mensagem mantém uma linha auditável em
`url_resolutions`, incluindo versão do pipeline, URL original/final, cadeia, status, tentativas e
erro reduzido a código. O parser v3 usa a URL final. Falha de encurtador gera parse parcial
`url_resolution_failed` e nunca oferta no domínio intermediário.

Snapshots passam a referenciar o parse e recebem estado ativo/sobrescrito. Ao reprocessar, menções e
snapshots anteriores ficam inativos, as contagens das ofertas afetadas são recalculadas e oferta sem
menção ativa expira. Nenhuma mensagem, resolução, parse, menção ou snapshot histórico é removido.

## Compatibilidade, migração e rollback

A migration `0003_first_living_lightning` cria `url_resolutions`, adiciona vínculos opcionais aos
dados históricos e substitui somente o índice de unicidade de snapshots para incluir o parse. Um
backfill liga snapshots existentes à menção mais recente quando a origem pode ser determinada.
Linhas sem origem inequívoca permanecem válidas com `parse_id` nulo.

O feed público não muda. Código anterior ignora as novas tabelas e colunas. Em rollback, desabilitar
o worker novo ou reverter o código; não desfazer nem apagar dados históricos. Outbox ainda não
publicada pode permanecer para replay quando o pipeline v3 voltar.

## Alternativas consideradas

- Redirect automático do cliente HTTP: rejeitado porque impede revalidar cada destino.
- Fetch após apenas validar DNS: rejeitado por abrir janela de DNS rebinding.
- Deduplicar a partir do encurtador: rejeitado porque o domínio e produto da loja ficam incorretos.
- Atualizar snapshots antigos no lugar: rejeitado por destruir auditoria.
