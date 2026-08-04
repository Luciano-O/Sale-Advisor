# Runbook operacional do coletor Telegram

Este procedimento cobre a identidade dedicada, rotação de credenciais, recuperação e rollback. As
evidências permitidas são apenas contagens, timestamps, estados e categorias de erro sanitizadas.
Nunca copie sessão, telefone, API hash, peer IDs ou mensagens completas para logs, tickets ou PRs.

## Preparar a conta dedicada

1. Criar uma identidade usada somente pelo Sale Advisor e habilitar 2FA.
2. Adicionar a conta somente aos grupos e canais da allowlist aprovada.
3. Gerar a sessão localmente com `pnpm --filter @sale-advisor/worker telegram:login` e armazená-la
   no secret manager. A saída não deve ser persistida no histórico do terminal.
4. Em um ambiente isolado, validar que cada referência configurada resolve e permite leitura. A
   evidência deve registrar apenas `fontes_configuradas`, `fontes_acessíveis` e a data.

## Troca controlada

1. Confirmar que a migration mais recente foi aplicada e que `GET /v1/admin/integrations` responde.
2. Registrar contagens agregadas de fontes, mensagens, cursores e fila `telegram-ingest`.
3. Parar todas as instâncias do worker. Confirmar no admin que não há heartbeat com menos de 45 s.
4. Substituir `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` e `TELEGRAM_SESSION` juntos. Não alterar
   `TELEGRAM_CHATS` durante a rotação.
5. Reiniciar duas instâncias, se disponíveis. Em até 45 s deve haver exatamente uma ativa e as
   demais em standby.
6. Confirmar continuidade pelos mesmos cursores persistidos, sem imprimir os identificadores.
7. Executar um smoke test com uma nova mensagem controlada e validar as contagens agregadas de
   `raw_messages`, outbox, menções, snapshots e erros.
8. Observar heartbeat, retry, fila e evolução das contagens por até 24 horas. Somente depois revogar
   a sessão anterior em **Telegram > Configurações > Dispositivos**.

## Recuperação

- `authentication_invalid`, `session_revoked`, `api_id_invalid` ou `source_inaccessible`: corrigir
  credencial/permissão e reiniciar; não há retry automático.
- `flood_wait`: aguardar `nextRetryAt`; não reiniciar para antecipar a tentativa.
- `transient`: acompanhar o backoff de 1 a 60 s com jitter. Se todas as instâncias perderem o banco,
  a conexão que detém o advisory lock é encerrada pelo PostgreSQL e outra instância pode assumir.
- `unknown`: após cinco falhas a instância fica bloqueada. Preserve a categoria sanitizada e faça
  diagnóstico offline antes de reiniciar.

## Rollback

1. Parar o worker e restaurar o conjunto anterior de secrets no secret manager.
2. Reiniciar e confirmar exatamente uma instância ativa, continuidade de cursores e smoke test.
3. Se o coletor continuar inseguro, usar `TELEGRAM_ENABLED=false` e manter API/processors ativos.
4. Não remover `collector_instances`, mensagens, parses ou cursores. A migration é compatível com o
   código anterior; rollback de código deve ser um `git revert` revisado.

## Critérios de encerramento

- uma instância ativa e heartbeat com no máximo 45 s;
- fontes configuradas e persistidas coerentes;
- nenhum secret ou identificador de chat nos logs/admin;
- fila sem crescimento contínuo de `failed`;
- continuidade do cursor e uma mensagem de smoke processada uma única vez.
