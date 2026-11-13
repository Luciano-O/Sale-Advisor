# ADR 0009: modelo de produto multi-categoria

- Status: aceita
- Data: 2026-11-13
- Issue: HW-02 do [plano de categorias](../roadmap/01-hardware-categories.md)
- Base: [relatório da HW-01](../reports/2026-11-11-hw01-category-coverage.md)

## Contexto

O pipeline inteiro assume placa de vídeo: o produto canônico é
`CanonicalGpuProduct { vendor, model, vramGb }`, o banco tem `vram_gb` e unicidade por
`(vendor, model, vram_gb)`, o contrato público aceita só `category: "GPU"` e o app trata toda oferta
como GPU (`mapOffer` e `push.ts` fixam a categoria).

A HW-01 mediu as fontes. Com o canal de hardware em geral adicionado em 2026-11-11, em 3 dias de
histórico:

- processador, memória, SSD/HD e placa-mãe passaram da meta de 30 mensagens; fonte ficou em 28;
- 87 mensagens são de notebook, PC montado ou kit;
- 898 mensagens não são de hardware.

Há volume para as cinco categorias novas. Kits, PCs e notebooks aparecem desde o primeiro dia, então
a regra que os descarta precisa existir antes da primeira categoria nova.

Só um aparelho usa o app (ADR 0007 e 0008), mas o APK instalado não muda sozinho. Cada passo do
backend precisa funcionar com ele até a HW-08 ser instalada.

## Decisão

### 1. Produto canônico genérico

```ts
type ProductCategory = "GPU" | "CPU" | "RAM" | "STORAGE" | "PSU" | "MOBO";

interface CanonicalProduct {
  id: string; // canonical_key
  category: ProductCategory;
  brand: string | null;
  model: string;
  attributes: ProductAttributes[ProductCategory]; // objeto pequeno, tipado por categoria
}
```

- As chaves de categoria são estas seis, em inglês e maiúsculas, as mesmas do relatório da HW-01.
  Nunca são renomeadas: ficam no banco, nas preferências locais e no contrato.
- `brand` é a marca que **faz parte da identidade** do produto. Ela é `null` quando a categoria se
  identifica pela especificação (memória RAM).
- A marca de quem fabrica o item anunciado (a ASUS de uma RTX, a Kingston de um pente de memória)
  fica na oferta, não no produto. É a generalização de `boardBrand`, que passa a se chamar
  `listingBrand`. O filtro de marcas bloqueadas do app compara com `brand` e `listingBrand`.
- `attributes` guarda só o que a categoria precisa para chave, nome de exibição e filtro. Os valores
  vêm do texto ou da taxonomia, nunca de um LLM.

### 2. O produto canônico é a unidade de comparação de preço

Dois anúncios só entram no mesmo histórico se um comprador os consideraria o mesmo item. Seguir no
app pode ser mais amplo que o produto canônico. Por isso cada categoria define também o **item
seguível** (`followKey`), que é o que o app guarda em `subcategories[categoria].products`.

| Categoria      | Chave     | Produto canônico (`canonical_key`)                          | Exemplo de chave                | Atributos                                      | Item seguível                  |
| -------------- | --------- | ----------------------------------------------------------- | ------------------------------- | ---------------------------------------------- | ------------------------------ |
| Placa de vídeo | `GPU`     | fabricante do chip + modelo + VRAM (sem mudança)            | `nvidia-rtx-5070-12gb`          | `vramGb`                                       | modelo (`RTX 5070`), como hoje |
| Processador    | `CPU`     | marca + modelo exato; sufixos (X, X3D, F, K, KF, G) separam | `cpu-amd-ryzen-5-5600`          | `family`, `socket`                             | modelo exato (`Ryzen 5 5600`)  |
| Memória RAM    | `RAM`     | geração + formato + capacidade total + kit + frequência     | `ram-ddr4-dimm-16gb-2x8-3200`   | `generation`, `formFactor`, `modules`, `mhz`   | geração + formato + capacidade |
| SSD / HD       | `STORAGE` | marca + linha + capacidade                                  | `storage-kingston-nv3-1tb`      | `type` (NVMe, SATA, HD 3,5", HD 2,5", externo) | linha + capacidade             |
| Fonte          | `PSU`     | marca + linha + potência                                    | `psu-corsair-rm-750w`           | `watts`, `efficiency`, `modular`               | linha + potência               |
| Placa-mãe      | `MOBO`    | marca + modelo exato normalizado                            | `mobo-asus-tuf-b650m-plus-wifi` | `chipset`, `socket`, `formFactor`              | chipset (`B650`)               |

Regras da tabela:

- **GPU não muda.** A chave continua `{vendor}-{modelo}-{vram}gb` ou `-unknown-vram`, sem prefixo,
  para preservar produtos, aliases e histórico. A marca da placa continua na oferta.
- **Categorias novas usam a chave da categoria como prefixo** (`cpu-`, `ram-`, `storage-`, `psu-`,
  `mobo-`). Assim `canonical_key` segue única no banco inteiro sem risco de colisão entre categorias
  (uma Kingston de SSD e uma de memória, por exemplo).
- **Capacidade** é normalizada antes da chave: valores a partir de 1000 GB viram TB (`1tb`, `2tb`),
  o resto fica em GB (`480gb`, `512gb`).
- **Box, tray e "com cooler"** são atributos da oferta, não do processador: o preço deles cai no
  mesmo histórico, e o score não diferencia nesta fase.
- **Selo 80 Plus e modularidade** são atributos do produto, vindos da taxonomia quando a linha os
  fixa. Linhas diferentes de uma mesma marca (RMe e RMx) são produtos diferentes.
- **Latência e cor da memória** não entram na chave nem nos atributos nesta fase.
- **Texto que não casa com a taxonomia fica sem produto** e aparece no relatório do parser, como
  hoje. O admin cobre lacunas com aliases, que passam a ter categoria.

### 3. Taxonomia controlada e determinística

Todas as categorias usam listas controladas no `packages/domain`, como GPU. Sem LLM nesta fase
(`AGENTS.md`). Cada categoria fornece ao registro: identificador, marcas aceitas, formatação do nome
de exibição e item seguível.

### 4. Roteador de categoria e o que não vira oferta de componente

Uma mensagem tem um produto principal. Antes de identificar o produto, um roteador decide a
categoria:

1. **Termo de peça no início manda.** Se o título começa por um termo de peça ("Placa de vídeo",
   "Processador", "Memória", "SSD", "HD", "Fonte", "Placa-mãe"), a categoria é dessa peça. Modelos de
   outra categoria citados depois são compatibilidade ("Placa-mãe B550M para Ryzen 5000") e não
   mudam a categoria.
2. **Sem termo de peça, manda o primeiro modelo conhecido**, como hoje para GPU.
3. **Computador antes da peça descarta.** Notebook, laptop, PC gamer, computador, desktop,
   all-in-one, mini PC, console, Playstation e Xbox antes do modelo fazem a mensagem não virar oferta
   de componente. É a regra atual de `isComputerListing`, aplicada a todas as categorias.
4. **Kit de peças descarta.** "Kit upgrade", "combo" ou modelos de duas categorias diferentes unidos
   por "+" ou "e" no título ("Ryzen 5 5600 + B550M") não viram oferta. Exceção: "kit" de memória
   (2x8GB, 2x16GB) é um produto RAM, não um kit de peças.
5. **Acessório descarta.** Suporte de placa de vídeo, riser, cabo, adaptador, gaveta de SSD,
   dissipador, cooler, pasta térmica, carregador, fonte de notebook e fonte de LED não viram oferta
   da categoria que citam.

Kits e PCs montados não viram produto nesta fase. A mensagem bruta fica preservada e conta no
relatório do parser, então a decisão pode mudar com dados.

### 5. Ordem das categorias

Processadores, memórias, SSDs/HDs, fontes e placas-mãe (HW-09 a HW-13), da taxonomia mais fechada
para a mais aberta. A HW-01 não muda a ordem: as cinco têm fonte, e fonte (PSU) só precisa
confirmar a meta de 30 mensagens em 30 dias na HW-12.

### 6. Compatibilidade com o APK instalado

- **Sem categoria na requisição significa GPU.** Nos endpoints `v1` que listam ou filtram (feed,
  catálogo e preferências de notificação), a ausência do parâmetro de categoria equivale a `GPU`. O
  detalhe da oferta é por id e não precisa de filtro: o APK atual só chega a uma oferta pelo feed ou
  pelo push, que já vêm filtrados. O APK atual nunca envia categoria no feed nem no catálogo e envia `category: "GPU"` nas
  preferências, então continua vendo exatamente o que vê hoje. O APK novo (HW-08) sempre envia as
  categorias de forma explícita. O formato do parâmetro fica para a HW-06.
- **Campos novos são aditivos.** A oferta pública ganha `category`, `brand`, `model`,
  `displayName`, `followKey` e `attributes`. `vendor` e `vramGb` continuam no payload de oferta e
  de push enquanto existir um APK anterior à HW-08.
- **Categoria ativada.** Uma tabela de categorias guarda chave, nome e `enabled`. GPU nasce ativada.
  Uma categoria desativada é identificada, gravada e pontuada, para acumular histórico, mas não
  aparece em feed, catálogo e push. O admin ativa uma categoria depois da definição de pronto
  (HW-07). Ativar não dispara push das ofertas que já existiam: o push continua decidido quando a
  oferta é criada ou muda de rótulo.
- **Inscrição de notificação** passa de uma categoria para um conjunto. A linha atual (`GPU`) vira
  `{GPU}`, e um `PUT` com `category: "GPU"` continua gravando `{GPU}`.
- **Preferências locais não mudam.** O formato v2 (ADR 0008) já guarda subcategorias por chave. O
  que muda é o conteúdo de `products`, que passa a ser o item seguível da categoria. Para GPU, o
  item seguível é o modelo, como hoje, então nenhuma preferência salva precisa de conversão.

### 7. Preço e score por categoria

- A faixa de preço da deduplicação deixa de ser R$ 50 fixos e passa a ser proporcional ao preço ou
  configurada por categoria (HW-05).
- A política de score ganha limiares e piso de sanidade por categoria. Todos começam iguais aos de
  GPU e são calibrados na HW-14. O score de GPU não muda para as mesmas entradas.

## Migração

Todas as mudanças de banco são aditivas e entram por migration (HW-04):

- `products`: `attributes jsonb not null default '{}'`, `brand` nullable e `category` gravada pelo
  código (o default `GPU` fica no banco só para o código antigo). `vram_gb` continua preenchida para
  GPU durante a transição.
- O índice único `(vendor, model, vram_gb)` passa a ser parcial, só para `category = 'GPU'`. Nenhum
  `insert` usa esse índice como alvo de `on conflict`; a unicidade geral já é a de `canonical_key`.
- Tabela de categorias com as seis chaves; só GPU ativada.
- `notification_subscriptions`: conjunto de categorias preenchido a partir da coluna atual, que é
  mantida enquanto existir código que a lê.
- `product_aliases` ganham categoria pelo produto a que apontam.

Produtos GPU existentes mantêm `canonical_key`, ofertas e histórico. As categorias novas ganham
histórico retroativo com o reprocessamento das `raw_messages` (ADR 0005), sem notificar.

## Rollback

- **Código:** `git checkout` da versão anterior, como no runbook da VPS. As migrations aditivas não
  quebram o código antigo: ele não lê as colunas novas e só cria produtos GPU.
- **Dados de categorias novas com código anterior à HW-06:** o feed antigo não filtra por
  categoria e mostraria processadores como placas de vídeo. Enquanto as categorias novas estiverem
  desativadas, isso já não acontece no código novo, mas o código antigo ignora a ativação. Antes de
  voltar a API para antes da HW-06, expirar as ofertas ativas que não são GPU
  (`update offers set status = 'expired'` filtrando pela categoria do produto). Produtos, menções e
  histórico de preços continuam no banco e voltam a ser usados quando o código novo voltar.
- **APK:** o APK da HW-08 lê o payload novo, mas aceita a ausência dos campos novos, então funciona
  com um backend revertido, só com GPU.

## Consequências

- Uma categoria nova começa a acumular histórico antes de aparecer no app, então já nasce com score
  útil quando é ativada.
- O APK atual segue funcionando em toda a sequência HW-03 a HW-07 sem atualização.
- Memória RAM é seguida e comparada por especificação. Quem quer uma marca específica não tem esse
  filtro nesta fase, só o de marca bloqueada.
- Placa-mãe tem chave por modelo exato e segue por chipset. É a categoria com mais risco de ficar
  "sem produto canônico"; a HW-13 aceita cobertura parcial e mede no relatório.
- O relatório do parser passa a separar, por categoria, mensagens sem produto, descartadas como kit
  ou computador e descartadas como acessório.
- O código ganha um registro de categorias em vez de um identificador único. Cada categoria nova é
  uma entrada no registro, com testes próprios.

## Alternativas consideradas

- **Uma tabela por categoria** (`gpus`, `cpus`...). Rejeitada: ofertas, menções, histórico e score
  são iguais para todas, e cada categoria nova exigiria migration e joins novos.
- **Memória RAM com marca no produto canônico.** Rejeitada: o histórico de cada pente ficaria com
  poucos preços, e o comprador compara memória pela especificação.
- **Placa-mãe com produto canônico por chipset.** Rejeitada: placas do mesmo chipset variam muito de
  preço (de entrada a topo de linha), e o score compararia itens diferentes. O chipset fica como
  item seguível.
- **Endpoints `v2` para o APK novo.** Rejeitada por agora: "sem categoria significa GPU" mantém o
  APK atual funcionando com um único conjunto de endpoints. `v2` volta à mesa se o contrato precisar
  de uma quebra de verdade.
- **Kits e PCs montados como produto.** Adiada: fora do escopo do plano, e as mensagens brutas ficam
  preservadas para decidir depois.
- **Identificar com LLM.** Adiada pelo `AGENTS.md` até haver dados rotulados.
