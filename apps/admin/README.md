# Admin

Workspace React/Vite para operação e curadoria do MVP:

- dashboard do pipeline;
- cadastro manual e importação JSON com preview;
- mensagens brutas, parses e replay;
- ofertas, score, merge e split;
- produtos e aliases;
- sources/stores e bloqueios;
- auditoria administrativa.

A chave é solicitada ao abrir o painel e mantida somente em `sessionStorage`. Configure
`VITE_API_URL` quando a API não estiver em `http://localhost:3000`.

```powershell
pnpm --filter @sale-advisor/admin dev
```
