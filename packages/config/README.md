# Config

Configurações compartilhadas de TypeScript, lint, formatting e ambiente. O módulo runtime valida
URLs de PostgreSQL/Redis, CORS, proxy, rate limit, nível de log e provider de notificação antes do
startup da API e do worker. Em produção, origins, proxy e provider devem ser explícitos.
