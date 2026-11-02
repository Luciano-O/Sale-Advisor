# ADR 0008: preferências locais v2 e limiar fixo

- Status: aceita
- Data: 2026-11-02
- Complementa: [ADR 0003](0003-local-preferences-and-push.md)

## Contexto

O redesign do app tirou do usuário a decisão sobre qual oferta é boa o bastante. O formato antigo de
preferências guardava `followedModels` e `minimumLabel`, e não comportava seguir uma subcategoria
inteira nem todo o hardware.

## Decisão

- **Preferências v2.** O formato local passa a ser
  `{ version: 2, onboardingCompleted, followAll, subcategories, blockedStores, blockedBrands, alertsEnabled, analyticsEnabled }`,
  em que cada subcategoria tem `mode` (`inteira` ou `produtos`) e `products`.
- **Conversão na leitura.** `migratePreferences` converte o formato antigo sempre que lê, e o novo
  só é gravado no próximo salvamento. Modelos seguidos viram GPU em `produtos`; nenhum modelo vira
  GPU `inteira`; quem já tinha preferências salvas não passa pelo onboarding.
- **Fim do nível mínimo.** O limiar é fixo em `boa`, no filtro do aparelho. O servidor continua
  recebendo só a categoria e `minimumLabel: "boa"`, porque o contrato da API segue igual.
- **Permissão de notificação.** O app só pede a permissão na etapa Alertas do onboarding, não mais a
  cada abertura. O filtro de push respeita `alertsEnabled`.
- **Um canal de push por rótulo.** Implementado na fase seguinte do redesign: `offers-boa`,
  `offers-muito-boa` e `offers-excepcional`. Silenciar um rótulo é feito nas configurações do Android.

## Consequências

- Quem usava um nível mínimo acima de `boa` passa a ver ofertas `boa`.
- Quem nunca salvou preferências passa pelo onboarding, mesmo com o app já instalado.
- Quem pular o onboarding segue todo o hardware, com os alertas desligados.
- "Apagar dados deste aparelho" cria um código novo, e o registro antigo fica órfão no servidor,
  porque ainda não existe endpoint para apagar uma instalação. Antes de apagar, o app tira o token
  de push desse registro. Sem conexão nesse momento, o token fica lá, e o que chegar por ele ainda
  passa pelo filtro do aparelho.

## Migração e rollback

- **Migração:** nenhuma etapa é necessária na instalação. O SQLite não muda, pois as preferências já
  ficam em JSON na tabela `preferences`.
- **Rollback:** um APK anterior lê o JSON v2 sem os campos antigos e quebra. Como o banco v2 da fase
  anterior já impede abrir um APK antigo (`Unsupported local schema version`), a saída é a mesma:
  limpar os dados do app. O risco é aceito porque só um aparelho usa o app hoje.
