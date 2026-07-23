# Madeireira Frontend — contexto do projeto

> Referência para sessões futuras (inclusive em outra máquina). Todo o conteúdo abaixo foi extraído do código-fonte real, não de memória — onde há incerteza, isso está dito explicitamente.

## Visão geral

Frontend do ERP de uma madeireira. SPA em React que consome uma API Spring Boot em `http://localhost:8080/api/v1` (base URL hardcoded em `src/lib/api.ts`, sem variável de ambiente). Autenticação via JWT: o token vem de `POST /auth/login` e é guardado em `localStorage` (chaves `madeireira.token` / `madeireira.user`); qualquer resposta `401` fora da própria chamada de login limpa o storage e redireciona para `/login`.

**Estado atual — módulos prontos e roteados** (confirmado em `src/App.tsx` e na sidebar de `Shell.tsx`):

| Módulo | Rota | Status |
|---|---|---|
| Dashboard | `/dashboard` | pronto — KPIs, alertas, busca global, notificações |
| Cadastros → Clientes | `/cadastros/clientes` | pronto |
| Cadastros → Produtos | `/cadastros/produtos` | pronto |
| Cadastros → Fornecedores | `/cadastros/fornecedores` | pronto |
| Estoque | `/estoque` | pronto |
| Compras | `/compras` | pronto |
| Vendas | `/vendas` | pronto |
| Financeiro | `/financeiro` | pronto |
| Fiscal | `/fiscal` | pronto (NFs de entrada/saída, vínculo com pedidos de venda e compra) |
| Configurações | `/configuracoes` | **placeholder** — o componente só renderiza `<div>Em construção</div>` |

## Stack

Versões exatas de `package.json` (não arredondar em sessões futuras — conferir de novo se o arquivo mudar):

| Categoria | Pacote | Versão |
|---|---|---|
| Build | vite | ^8.1.1 |
| Build | @vitejs/plugin-react | ^6.0.3 |
| Framework | react / react-dom | ^19.2.7 |
| Linguagem | typescript | ~6.0.2 |
| Estilo | tailwindcss | ^3.4.19 |
| Estilo | tailwindcss-animate | ^1.0.7 |
| Estilo | class-variance-authority | ^0.7.1 |
| Estilo | clsx / tailwind-merge | ^2.1.1 / ^3.6.0 |
| UI | shadcn/ui | não é dependência npm — componentes copiados em `src/components/ui/`, sobre Radix |
| UI | @radix-ui/react-* | alert-dialog ^1.1.18, dialog ^1.1.18, label ^2.1.11, select ^2.3.2, separator ^1.1.11, slot ^1.3.0, toast ^1.2.18 |
| Ícones | lucide-react | ^1.23.0 |
| Roteamento | react-router-dom | ^7.18.1 |
| HTTP | axios | ^1.18.1 |
| Server state | @tanstack/react-query | ^5.101.2 |
| Formulários | react-hook-form | ^7.80.0 |
| Formulários | @hookform/resolvers | ^5.4.0 |
| Validação | zod | ^4.4.3 |
| Gráficos | recharts | ^3.9.1 — usado só em `FinanceiroPage.tsx` (aba Fluxo de Caixa) |
| PDF | @react-pdf/renderer | ^4.5.1 |
| Toast | sonner | ^2.0.7 |

Dev: `eslint` ^10.6.0, `typescript-eslint` ^8.62.0, `eslint-plugin-react-hooks` ^7.1.1, `eslint-plugin-react-refresh` ^0.5.3, `postcss` ^8.5.16, `autoprefixer` ^10.5.2.

**React Compiler NÃO está habilitado** neste projeto (sem plugin no `vite.config.ts`, sem dependência no `package.json`; o `README.md` — texto padrão do template Vite — confirma isso explicitamente). Não atribuir escolhas de código a otimizações do Compiler.

## Como rodar

```bash
npm install
npm run dev       # vite, porta padrão 5173
npm run build     # tsc -b && vite build
npm run lint      # eslint .
npm run preview   # serve o build de produção
```

Pré-requisito: **backend Spring Boot rodando em `http://localhost:8080`** (não configurável por env var — está hardcoded em `src/lib/api.ts`). Sem ele, toda tela cai em erro/loading eterno.

**Credenciais de teste: não há nenhuma documentada no repositório** (nem no README, nem hardcoded em `LoginPage.tsx`, nem em `AuthContext.tsx`). Se precisar logar, pegar um usuário com o backend/DBA do projeto.

## Estrutura de pastas

```
src/
├── pages/            uma tela por módulo, ligadas em App.tsx (ver "Rotas")
├── hooks/             um hook por recurso da API (ver "Padrões de código")
├── components/
│   ├── layout/Shell.tsx      shell da aplicação: sidebar + topbar + slots de busca/perfil/notificações
│   ├── pdf/                  os 3 documentos @react-pdf/renderer (ver "Geração de PDF")
│   ├── ui/                   shadcn/ui — componentes copiados (não é pacote instalado)
│   └── ComboboxBusca.tsx     combobox de busca com debounce reutilizado em várias telas
├── contexts/AuthContext.tsx  login/logout/token, único contexto do app
├── lib/
│   ├── api.ts         instância axios (baseURL, interceptors de auth)
│   ├── queryClient.ts  instância do QueryClient (staleTime: 30s)
│   ├── utils.ts        cn() — clsx + tailwind-merge
│   └── bancos.ts       lista estática de bancos (usada no Financeiro)
├── styles/globals.css  tokens de tema, gradiente de fundo, Tailwind layers
├── App.tsx             <Routes> + PrivateRoute
└── main.tsx            providers: QueryClientProvider → BrowserRouter → AuthProvider
```

## Design system

Fonte: `src/styles/globals.css` + `tailwind.config.js` + padrões repetidos inline nas páginas.

**Gradiente de fundo** (`--bg-gradient`, aplicado no `<body>` e de novo inline no `Shell`):
```css
linear-gradient(135deg, #0a1628 0%, #0d2137 25%, #091a10 55%, #061208 75%, #081828 100%)
```

**Glassmorphism dos cards** — atenção: existe uma classe utilitária `.glass` em `globals.css` (`background: var(--glass-bg); border: 1px solid var(--glass-border); backdrop-filter: blur(16px)`), mas **nenhuma página a usa**. O padrão real, repetido à mão em todas as telas, é a combinação de utilities Tailwind:
```
rounded-[20px] bg-white/[0.04] backdrop-blur-[20px]
```
— **sem borda**. Isso é uma inconsistência entre a classe declarada e o que o código de fato usa (ver seção final).

**Acento verde `#4ade80`** (`--accent` no CSS; também é o `--primary` do shadcn em HSL `142 69% 58%`) — usado em: botões primários, pills de "aba ativa", ícone ativo da sidebar (`bg-[rgba(74,222,128,0.18)] text-[#4ade80]`), valores de destaque (totais em R$), faixa de 3px no topo dos PDFs, hover states de sucesso.

**KPI cards do Dashboard** (`src/pages/DashboardPage.tsx`) — 6 cards, cada um com um `linear-gradient(135deg, …)` próprio, `rounded-[20px] p-3.5`, hover `scale-[1.03]` + `shadow-[0_8px_32px_rgba(0,0,0,0.25)]`, ícone fantasma no canto (`text-white/10`, size 60):

| Card | Gradiente |
|---|---|
| Produtos em estoque | `#14532d → #15803d` (verde) |
| Pedidos do mês | `#1e3a5f → #1d4ed8` (azul) |
| A receber [mês] | `#78350f → #b45309` (âmbar) |
| Estoque crítico | `#7f1d1d → #b91c1c` (vermelho) |
| Contas vencidas | `#450a0a → #7f1d1d` (vermelho escuro) |
| Pedidos pendentes | `#4c1d95 → #7c3aed` (roxo) |

**Pills de status por módulo** — todas seguem `inline-block rounded-full px-2.5 py-0.5 text-xs font-medium`, cada tela com seu próprio `Record<string, {label, className}>`:

Pedido de venda (`VendasPage.tsx`):
| Status | className |
|---|---|
| RASCUNHO | `bg-white/10 text-white/55` |
| CONFIRMADO | `bg-blue-500/15 text-blue-400` |
| FATURADO | `bg-purple-500/15 text-purple-400` |
| ENTREGUE | `bg-[rgba(74,222,128,0.15)] text-[#4ade80]` |
| CANCELADO | `bg-red-500/15 text-red-400` |

Conta a receber/pagar (`FinanceiroPage.tsx`):
| Status | className |
|---|---|
| ABERTO | `bg-blue-500/15 text-blue-400` |
| PAGO | `bg-[rgba(74,222,128,0.15)] text-[#4ade80]` |
| VENCIDO | `bg-red-500/15 text-red-400` |
| CANCELADO | `bg-white/10 text-white/55` |

Nota fiscal (`FiscalPage.tsx`) — cores mais "apagadas" (opacidade extra) que os outros módulos:
| Status | className |
|---|---|
| ESCRITURADA_MANUAL | `bg-blue-500/10 text-blue-400/80` |
| EMITIDA_MANUALMENTE | `bg-[rgba(74,222,128,0.1)] text-[#4ade80]/80` |
| CANCELADA | `bg-red-500/15 text-red-400 line-through` |

Pedido de compra (`ComprasPage.tsx`):
| Status | className |
|---|---|
| RASCUNHO | `bg-white/10 text-white/55` |
| CONFIRMADO | `bg-blue-500/15 text-blue-400` |
| RECEBIDO | `bg-[rgba(74,222,128,0.15)] text-[#4ade80]` |
| CANCELADO | `bg-red-500/15 text-red-400` |

**Sidebar**: `w-16` (64px) por padrão, expande para `w-[180px]` (`transition-[width] duration-200`) quando o submenu de Cadastros está visível — o que acontece automaticamente em qualquer rota `/cadastros/*` ou ao clicar manualmente no botão Cadastros. Ordem dos ícones (`modulosNav` em `Shell.tsx`): Dashboard (fixo no topo) → Cadastros (expansível) → Estoque → Compras → Vendas → Financeiro → Fiscal → Configurações (fixo no rodapé).

**Paleta dos PDFs — diferente da tela** (fundo claro, pensado para impressão). Os três documentos (`PedidoPDF.tsx`, `NotaFiscalPDF.tsx`, `PedidoCompraPDF.tsx`) compartilham o mesmo `StyleSheet`:
- `page`: fundo branco, `fontSize: 9`, `fontFamily: 'Helvetica'`
- `headerWrapper`: fundo navy `#0a1628`, sangra até a borda da página (margin negativo)
- `headerAccent`: faixa de 3px, `#4ade80`, também full-bleed
- `secaoHeader`: fundo `#1e3a5f`, texto branco, borda esquerda de 4px `#4ade80`
- `tabelaHeaderRow`: fundo `#0a1628`, texto branco
- `tabelaRowAlt` (linhas pares): fundo `#f0f4f8`
- `totalDestaqueLinha`: fundo navy `#0a1628`, valor em verde `#4ade80`
- rodapé: linha de 1.5px `#4ade80` + texto cinza `#64748b` centralizado

## Rotas e navegação

| Rota | Página | Ícone na sidebar |
|---|---|---|
| `/` | redirect → `/dashboard` | — |
| `/login` | `LoginPage` (pública) | — |
| `/dashboard` | `DashboardPage` | `LayoutDashboard` |
| `/cadastros/clientes` | `ClientesPage` | `UserRound` (submenu) |
| `/cadastros/produtos` | `ProdutosPage` | `Package2` (submenu) |
| `/cadastros/fornecedores` | `FornecedoresPage` | `Truck` (submenu) |
| `/estoque` | `EstoquePage` | `Package` |
| `/compras` | `ComprasPage` | `ShoppingCart` |
| `/vendas` | `VendasPage` | `Receipt` |
| `/financeiro` | `FinanceiroPage` | `Coins` |
| `/fiscal` | `FiscalPage` | `FileText` |
| `/configuracoes` | `ConfiguracoesPage` | `Settings` |
| `*` (qualquer outra) | redirect → `/dashboard` | — |

`PrivateRoute` (em `App.tsx`) checa `useAuth().isAuthenticated` (= `Boolean(token)`) e redireciona para `/login` com `replace` se não autenticado. Não há guard de perfil/role — qualquer usuário logado acessa todas as rotas.

## Padrões de código

Consistência entre telas depende de seguir isto ao criar uma tela nova:

- **Um hook por módulo em `src/hooks/`** (`useClientes`, `useProdutos`, `useFornecedores`, `useEstoque`, `useVendas`, `useCompras`, `useFinanceiro`, `useFiscal`, `useUsuarios`, `useDashboard`). Cada um expõe: query de listagem (`use<Recurso>s`, filtros como parâmetros posicionais + página), query de detalhe (`use<Recurso>`, `enabled: id != null`), uma `fetch<Recurso>()` avulsa (mesma query key do detalhe, para pré-carregar via `queryClient.fetchQuery` antes de abrir edição/gerar PDF) e mutations que invalidam a query key certa — nunca mais que o necessário (ex.: `useCompras` só invalida `['pedidos-compra']`; `useVendas` invalida `['pedidos']` + `['estoque']` + `['produtos']` nas transições que mexem em estoque).
- **Toda listagem**: busca com debounce de 400ms, filtros que fazem `setPage(0)` ao mudar, paginação via botões Anterior/Próximo (`SpringPage.totalElements`, não paginação numerada), skeleton de **5 linhas** enquanto carrega, estado vazio com ícone grande (`text-white/15`, `strokeWidth={1.2}`) + texto + CTA.
- **Abas em pills**, não o `Tabs` do shadcn — botões `rounded-full px-4 py-2` alternando `bg-[rgba(74,222,128,0.18)] text-[#4ade80]` (ativa) vs `bg-white/[0.04] text-[color:var(--text-secondary)]` (inativa).
- **`ComboboxBusca<T>`** (`src/components/ComboboxBusca.tsx`) é o combobox de busca genérico — já tem `ClienteCombobox`, `ProdutoCombobox`, `FornecedorCombobox` prontos; para pedidos (venda ou compra) cada tela declara um hook `useBusca...` local que passa por cima do hook do módulo.
- **Drawer lateral de 480px** para detalhes (`w-[480px] max-w-full`, `fixed inset-y-0 right-0`, overlay `fixed inset-0 bg-black/50`, `animate-in slide-in-from-right`) — usado em Vendas, Compras e Fiscal.
- **`AlertDialog`** para toda transição de status, sempre explicando o efeito colateral no texto (ex.: Compras deixa claro que confirmar **não** baixa estoque; Vendas deixa claro que confirmar baixa estoque).
- **React Hook Form + Zod**, com `useWatch` em vez de `form.watch()` nos componentes que recalculam valores ao vivo (itens de pedido, resumo de totais). **Correção em relação a uma suposição comum**: isso não é para contornar o React Compiler — ele não está habilitado neste projeto (ver seção Stack). É só a forma mais eficiente de assinar mudanças de campo específico com RHF.
- **Toasts via `sonner`** (`toast.success` / `toast.error`), com um helper `mensagemDaApi(error, fallback)` duplicado em cada página que lê `error.response.data.message ?? .erro ?? fallback`.
- **Máscaras de CPF/CNPJ/telefone/CEP feitas à mão**, sem biblioteca — `maskCpf`, `maskCnpj`, `maskTelefone`, `maskCep`, `maskDocumento` são funções **duplicadas** em `ClientesPage.tsx` e `FornecedoresPage.tsx` (não vivem em `lib/utils.ts`). Se for extrair para um lugar comum, esse é o ponto.

## Contrato com a API — armadilhas conhecidas

- **Todos os IDs são UUID string, nunca number.**
- **Os campos relacionados vêm PLANOS na maioria dos módulos** — isso já foi bug real duas vezes (Vendas e Compras), documentar com destaque:
  - `Pedido` (venda): `clienteCpfCnpj`, `clienteCidade`, `clienteUf`, `clienteIe`, `vendedorNome` direto no objeto — **não existe** `pedido.cliente.cpfCnpj`. O tipo `Pedido` em `useVendas.ts` nem declara um campo `cliente` aninhado.
  - `PedidoCompra`: mesma coisa — `fornecedorCpfCnpj`, `fornecedorCidade`, `fornecedorUf`, `fornecedorIe`, `usuarioNome` planos. Sem `pedidoCompra.fornecedor.cidade`.
  - `Produto`: `categoriaNome` plano, não `produto.categoria.nome`.
  - **Exceção a documentar**: `NotaFiscal` (Fiscal) e `ContaReceber`/`ContaPagar` (Financeiro) mantêm **os dois formatos ao mesmo tempo** — `fornecedorNome` plano *e* `fornecedor?: {razaoSocial, cpfCnpj, cidade, uf}` aninhado, por segurança/incerteza de contrato. Isso é uma inconsistência entre módulos, não um padrão a copiar — nos módulos novos (Vendas, Compras) o objeto aninhado simplesmente não existe no tipo.
- `cpfCnpj` é enviado **com máscara** (`values.cpfCnpj.trim()`, pontos/barra incluídos); `telefone`/`celular`/`cep` vão **só com dígitos** (`soDigitos()` antes de montar o payload). Confirmado em `ClientesPage.tsx` (`formParaPayload`).
- Datas no payload sempre `yyyy-MM-dd` (inputs `type="date"` já entregam nesse formato nativamente).
- Valores numéricos como `number`, nunca string — os formulários guardam como string internamente (para não perder o "" enquanto o usuário digita) e convertem só no `formParaPayload`.
- **Preço unitário difere entre Vendas e Compras** (ver também a tarefa que criou o módulo de Compras): em pedido de **venda** o `precoUnitario` **não vai** no payload — `PedidoInput.itens` só tem `produtoId, quantidade, descontoPerc`; o backend usa o snapshot de `produtoVenda`. Em pedido de **compra** o `precoUnitario` **vai e é obrigatório** — `PedidoCompraInput.itens` tem `produtoId, quantidade, precoUnitario, descontoPerc`; é o preço negociado com o fornecedor, editável livremente mesmo depois de pré-preenchido com `produto.precoCusto`.
- `totalItens`/`qtdItens` vem no resumo da listagem; o array `itens` completo só é confiável no detalhe (`use<Recurso>(id)`) — as telas de listagem calculam a contagem com fallback `pedido.totalItens ?? pedido.itens?.length ?? pedido.qtdItens ?? 0` porque nem todo endpoint de lista devolve os três campos.
- **Gap encontrado nesta auditoria, não corrigido ainda**: `useEscriturarEntrada()` (em `useFiscal.ts`) invalida `['fiscal']`, `['estoque']`, `['produtos']`, `['financeiro']` — mas **não** `['pedidos-compra']`. Quando uma NF de entrada é escriturada com `pedidoCompraId`, o pedido de compra vira `RECEBIDO` no backend, mas a listagem de Compras só reflete isso depois de um refetch manual/remontagem da tela, porque a query key de Compras nunca é invalidada.

## Geração de PDF

Três documentos em `src/components/pdf/`, todos com o mesmo `StyleSheet` (ver paleta acima):

| Componente | Usado em | Nome do arquivo baixado |
|---|---|---|
| `PedidoPDF.tsx` | Vendas | `Pedido-{numero}.pdf` |
| `NotaFiscalPDF.tsx` | Fiscal (só NF de saída) | `NF-{numero}-{serie}.pdf` |
| `PedidoCompraPDF.tsx` | Compras | `Compra-{numero}.pdf` |

Padrão do botão de download (`BotaoPdfPedido` em Vendas, `BotaoNfPdf` em Fiscal, `BotaoPdfPedidoCompra` em Compras — três implementações irmãs, uma por arquivo, não compartilhadas): recebe ou o registro já carregado (`pedido`/`nota`, usado no drawer — gera na hora) ou só o `id` (usado na tabela — busca o detalhe via `queryClient.fetchQuery(fetch<Recurso>(id))` com spinner antes de gerar). Quando o blob do `PDFDownloadLink` fica pronto, um componente `DisparadorDownload` dispara o clique automaticamente via `useEffect` (não durante o render).

Nome da empresa e CNPJ estão **hardcoded de forma idêntica nos três arquivos** (`{ nome: 'Madeireira', cnpj: '00.000.000/0001-00' }`) e **nenhuma página passa a prop `empresa`** — é sempre esse default. Ver "Pendências".

**Configuração obrigatória em `vite.config.ts`**:
```ts
optimizeDeps: {
  include: ['@react-pdf/renderer', 'base64-js', 'unicode-properties', 'linebreak'],
}
```
`@react-pdf/renderer` depende de bibliotecas CJS profundas (`base64-js`, via `unicode-properties`/`linebreak`) que o Vite precisa pré-empacotar explicitamente para o interop CJS→ESM funcionar no dev server. **Sem isso o dev server quebra** com um erro do tipo `base64-js does not provide an export named 'default'`. Trocar `include` por `exclude` **não resolve** — já foi tentado.

## Pendências e próximos passos

- **Sem loading/transição entre rotas**: todas as páginas são importadas estaticamente em `App.tsx` (sem `React.lazy`/`Suspense`), e não há barra de progresso (`useIsFetching` do React Query não é usado em lugar nenhum do código). O bundle de produção já está em **~2,7 MB minificado** (`dist/assets/index-*.js`, confirmado via `npm run build` — o Vite avisa "Some chunks are larger than 500 kB"). Code splitting por rota é o próximo passo óbvio.
- **`ConfiguracoesPage` é só um placeholder** (`<div>Em construção</div>`) — abas de "Dados da empresa" e "Usuários" ainda por fazer. É também onde o nome/CNPJ da empresa deveria passar a vir de algum lugar configurável, em vez de hardcoded nos 3 PDFs.
- **Módulo de Relatórios**: não existe rota, hook ou página — não foi nem esboçado.
- **Nome e CNPJ da empresa hardcoded** nos três componentes de PDF (ver seção anterior) — nenhuma tela expõe um jeito de configurar isso.
- **Combobox de pedido de compra no modal de NF de entrada** (Fiscal) faz a busca client-side, filtrando em JS a lista já trazida por `usePedidosCompra(undefined, undefined, true)` — aceitável no volume atual, mas não escala se a lista de pedidos confirmados sem NF crescer muito (o hook não tem parâmetro de busca textual).
- **Busca global do topbar** (`Shell.tsx` → `GlobalSearchOverlay`) cobre só Clientes e Produtos — Pedidos foram propositalmente deixados de fora porque o backend não tem busca textual em `/pedidos`.
