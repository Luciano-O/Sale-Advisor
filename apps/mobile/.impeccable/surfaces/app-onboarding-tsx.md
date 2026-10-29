---
version: 1
slug: "app-onboarding-tsx"
primary_target: "app/onboarding.tsx"
related_targets: []
---

# Onboarding (primeira execução)

Modo: Operate. Público: alguém que nunca viu o app e quer comprar hardware, começando por GPU. Tarefa: escolher os produtos e ligar os alertas. Sucesso: sair do fluxo com alertas ligados e cair no feed já filtrado. O usuário nunca informa preço, porque o histórico decide. Fluxo: boas-vindas, subcategorias de hardware (seleção múltipla ou "seguir todo o hardware", que pula o passo de produtos), produtos (por subcategoria: "inteira" ou "produtos específicos" com busca rápida e escolha na lista; o campo sobe para o topo ao focar por causa do teclado), alertas (permissão de push), pronto. Seguir inteira = todas as ofertas boa ou melhor. Estados obrigatórios: lista de produtos sem conexão (segue com as subcategorias inteiras, sem texto livre) e push negado.

## Direction contract

THESIS: Toda oferta passa por um teste antes de chegar ao usuário. A tela mostra o teste, com a oferta de hoje contra a mediana de 30 dias e a mínima de 90 dias. Recusa o card de oferta com selo de "% OFF".

OWN-WORLD: Gráfico de barras de review de hardware em força total.

- Cores: fundo #F1F2F5, tinta #0B1220 e cobalto #2147F0. O cobalto marca "o que é seu e está em teste": seleções, chips, linhas escolhidas e faixas cheias de cobalto nos heróis. O laranja de sinal #FF6B2C, sempre com texto em tinta, aparece só em anotações do gráfico ("−11%", barra de hoje) e no rótulo "excepcional".
- Rampa de rótulos: normal #DDE1E8, boa #9DB0FB, muito boa #2147F0, excepcional #FF6B2C.
- Tipografia: Barlow Condensed 800 em tamanho cheio nos títulos (42–58px) e nos nomes de produto; Barlow na interface; numerais tabulares.
- Componentes: indicador de etapas em forma de eixo (barras nomeadas), botões primários retangulares em tinta (raio 8) com seta, painéis com raio 10, chips com raio 6, painel em tinta para o modo "seguir tudo".
- Símbolo: três barras com a mais curta em cobalto (no ícone, em laranja).

STORY: O usuário entende que não precisa saber preço, escolhe modelos, autoriza o push e confia no veredito.

FIRST VIEWPORT: Título de três linhas no topo. No centro, um painel com três barras horizontais (mediana, mínima, hoje em cobalto) e o veredito "Muito boa · 11% abaixo da mediana". Abaixo, uma frase dizendo que basta escolher os produtos. O botão "Começar", em pill de 56dp, fica na base.

FORM: Gráficos de benchmark de review, primeiro item da lista própria, escolhido como pick. Seed fca91234. Interação assinatura: as barras crescem a partir do eixo, a de hoje por último, e o veredito entra depois.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
