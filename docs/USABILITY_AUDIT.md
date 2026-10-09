# FinFam — Auditoria de usabilidade

> Fase 2 (auditor-ux). Avaliação dos fluxos, feedback visual (carregando/sucesso/
> erro/vazio), clareza de textos, consistência e onboarding. Baseada na leitura do
> código atual e na execução real do build de produção (`npm run build` + `npm start`).

## Fluxos do usuário

- **Login (`/login`)** — formulário "Usuário/Senha", botão que vira "Entrando..."
  durante o envio, erro em faixa vermelha e redirecionamento para `/` no sucesso.
  Funciona; não há texto de contexto ("por que só um login?") nem validação inline.
- **Acesso sem sessão** — `GET /` responde `307` para `/login` (middleware), sem
  mensagem explicando o redirecionamento.
- **Dashboard (`/`)** — renderiza `%` gigante, "N dias para o fim do mês", faixa de
  feedback e botão "Sair (usuario)" sobre fundo colorido. É o único fluxo de valor
  disponível hoje.
- **Dashboard sem banco** — a página **não** mostra tela de erro: exibe `0%` em cinza
  (`hsl(0 0% 45%)`), dias restantes calculados por data e "Ainda não há histórico
  suficiente.", com um aviso pequeno no rodapé. O usuário vê um dashboard plausível,
  porém falso.
- **Logout** — POST do formulário para `/api/auth/logout`; funciona, sem confirmação.
- **Cadastro de dados (entradas/saídas/gastos/cartões)** — **inexistente**. Não há
  como alimentar o sistema; o dashboard nunca reflete a realidade da família.
- **Histórico (`/historico`)** — **inexistente**; não há seletor de mês nem visão de
  meses anteriores.
- **Instalação PWA** — manifest válido (standalone, landscape), porém só há ícone SVG;
  o SW registra mas não faz cache (sem offline).

## Problemas de usabilidade

- **Produto inalcançável: nenhum CRUD existe** — a família não consegue cadastrar
  rendas, contas, gastos ou compras. Toda a jornada termina no dashboard estático.
- **Estado vazio enganoso** — sem dados, o protótipo mostra `0%` como se fosse uma
  leitura real (poderia significar "não gastou"). A SPEC §5.6 exige orientar o cadastro
  de entradas; a UI não orienta e não distingue "0% gasto" de "sem informação".
- **Erro de banco disfarçado de sucesso** — `dbError` mantém o número grande, os dias
  e o feedback na tela (`src/app/page.tsx:25-35,64-69`), apenas com um aviso `text-sm`
  no fim. O usuário não sabe que os dados são inválidos.
- **Feedback comparativo nunca aparece** — `loadDashboardData` busca snapshots
  anteriores (`src/lib/dashboard.ts:46-52`), mas o seed só cria o mês corrente
  (`prisma/seed.ts:64-75`). A feature que o usuário citou literalmente ("estão melhores
  que os últimos 4 meses") é invisível na prática.
- **Feedback pode ser injusto/errado** — compara o % **parcial do mês corrente** com
  meses fechados (no início do mês quase sempre "melhores") e, em empate, afirma
  "Estão piores que os últimos N meses." (`src/lib/finance.ts:127-134`).
- **Cor é o único sinal de estado** — não há rótulo textual do nível (ok/atenção/
  crítico); usuários com daltonismo não percebem a situação. Fundo `hsl(...,65%,42%)`
  com texto branco tem contraste fraco em verde-limão/amarelo (SPEC §7).
- **Sem feedback de carregamento** — não há skeleton/spinner nem `aria-live`; a
  transição login→dashboard e o recarregamento ficam em branco no tablet.
- **`maximumScale: 1`** (`src/app/layout.tsx:22`) bloqueia o pinça-para-zoom, ruim
  para acessibilidade em tablet.
- **Erro de login sem ação** — credenciais ausentes nas envs retornam o mesmo
  "Usuário ou senha inválidos"; o usuário não descobre que falta configuração.
- **Sem navegação/shell** — só existe o botão Sair; não há wayfinding para as futuras
  telas nem indicação de "onde estou".
- **Time zone local do servidor** — "dias para o fim do mês" e virada de mês dependem
  do fuso do processo (`src/lib/finance.ts:43-51`); pode contar o dia errado.
- **PWA incompleto na prática** — falta PNG 192/512 (maskable) e `apple-touch-icon`;
  Android/iOS podem não oferecer instalação plena ou exibir ícone quebrado.
- **Offline sem fallback** — `public/sw.js` não cacheia o app shell; sem rede o tablet
  abre em branco/erro.

## Recomendações priorizadas

- **P0 — telas de CRUD + navegação (shell com menu e Sair)** — sem isso a família não
  usa o produto; é o maior ganho de usabilidade e desbloqueia o valor central.
- **P0 — estados "vazio/erro/carregando" explícitos** — quando não há renda ou há
  falha de banco, mostrar tela dedicada com CTA "Cadastrar entradas" e esconder o `%`;
  nunca apresentar `0%` como leitura real. Elimina a leitura enganosa.
- **P0 — fazer o feedback prometido aparecer** — popular/derivar 4 meses de histórico
  no seed e definir se compara % atual ou **projetado** (recomendado: projetado) e
  tratar empate como "igual". Entrega a frase que o usuário pediu.
- **P1 — reforçar sinalização de estado** — rótulo textual do nível ("ok", "atenção",
  "crítico"), cor de texto por luminância e remoção de `maximumScale: 1` (contraste +
  acessibilidade).
- **P1 — feedback de carga e acessibilidade dinâmica** — skeleton na navegação,
  `aria-live` para erro/feedback e `focus` visível consistente. Reduz incerteza.
- **P1 — mensagens de erro acionáveis no login** — distinguir env ausente de
  credencial errada e orientar a configurar. Evita usuário travado sem explicação.
- **P2 — ícones PWA 192/512 + maskable + apple-touch-icon e cache do app shell** —
  instalação confiável e uso offline básico no tablet.
- **P2 — tela `/historico` com seletor de mês** — permite explorar meses e entender a
  comparação, hoje invisível.
- **P2 — robustez de fuso (America/Sao_Paulo)** — dias/mês corretos para a família.

## Evidência

Comandos e saídas reais desta fase (nenhum arquivo de código alterado; apenas este
documento de auditoria):

```
$ git branch --show-current
autoia/task-206

$ npm test
 ✓ src/lib/finance.test.ts (9 tests) 4ms
 Test Files  1 passed (1)
      Tests  9 passed (9)

$ npm run typecheck
> tsc --noEmit
(sem erros)

$ npm run build
 ✓ Compiled successfully
Route (app) ... ƒ /  ○ /login  ƒ /api/auth/login  ƒ /api/auth/logout

$ FINFAM_USER=familia FINFAM_PASS=... FINFAM_SESSION_SECRET=... PORT=3100 npm start

$ curl -o /dev/null -w "%{http_code} %{redirect_url}" http://127.0.0.1:3100/
307 http://127.0.0.1:3100/login          # sem sessão redireciona

$ curl -H "Cookie: finfam_session=<token>" http://127.0.0.1:3100/
0%
Renda do mês consumida
dias para o fim do mês
Ainda não há histórico suficiente
Banco de dados não configurado. Defina DATABASE_URL ...
Sair (familia)

$ grep -o 'background-color:hsl(...)' dash.html
background-color:hsl(0 0% 45%)            # cinza "neutro", mesmo sem dados

$ curl -X POST -d '{"user":"x","pass":"y"}' .../api/auth/login -w " [%{http_code}]"
{"error":"Usuário ou senha inválidos"} [401]

$ curl -X POST -d '{"user":"familia","pass":"..."}' .../api/auth/login -w " [%{http_code}]"
{"ok":true} [200]
```

Chave de leitura: sem `DATABASE_URL` a página **não** falha de forma explícita —
mostra `0%` cinza com aviso discreto. Esse é o estado vazio/erro padrão que a família
veria hoje.

---


# Rodada 2 — Fundação de dados (task #207)

> Fase 2 (auditor-ux) da task #207. Escopo: usabilidade do **onboarding de banco**
> (migrations/seed/README) e dos **estados do dashboard que dependem de dados**
> (vazio / erro / sem histórico / com histórico). Verificado em execução real
> (`npm test`, `typecheck`, `build`, `next start` + `curl`). Não há
> `prisma/migrations` nem `DATABASE_URL` no ambiente desta fase, então o ciclo
> `db:migrate`/`db:seed` não pôde ser executado ponta a ponta (registrado em
> Evidência).

## Fluxos do usuário

- **Onboarding do operador (provisionar do zero)** — `npm install`, `typecheck`,
  `test` e `build` funcionam; `db:migrate` não tem migration versionada para
  aplicar. O README manda `cp .env.example .env` → `npm run db:migrate` →
  `npm run db:seed` (`README.md:40-51`), mas `prisma/migrations/` não existe:
  `npm run db:deploy` (produção) não provisiona nada e `db:seed` falharia com
  "table does not exist". O operador não sabe se deu certo nem o que observar.
- **Dashboard com banco ausente/indisponível** — `/` autenticado exibe `0%`,
  fundo cinza `hsl(0 0% 45%)`, dias restantes e "Ainda não há histórico
  suficiente.", com aviso `text-sm` no rodapé sobre `DATABASE_URL`. O usuário vê
  um dashboard plausível ("0% gasto") em vez de perceber que não há dados.
- **Dashboard com dados reais, mas sem `MonthlySnapshot`** — `loadDashboardData`
  devolve `previousPercents: []` (`src/lib/dashboard.ts:46-52`) e a página mostra
  "Ainda não há histórico suficiente." mesmo havendo transações. É exatamente o
  critério de aceite que a task quer eliminar, e hoje é o comportamento padrão do
  seed, que só cria o mês corrente (`prisma/seed.ts:64-75`).
- **Dashboard com 4 meses de snapshot (após a entrega)** — espera-se
  "Estão melhores/piores que os últimos 4 meses". Depende de o seed gravar 4
  snapshots fechados com `monthKey` contíguo e **coerente com o `%` calculado**
  das transações.
- **Reexecutar o seed** — `prisma/seed.ts:6-11` faz `deleteMany()` em todas as
  tabelas antes de recriar: reexecutar não duplica, mas **apaga** dados reais da
  família. É "idempotente" no papel, destrutivo na prática.

## Problemas de usabilidade

- **Sem migrations versionadas → onboarding não reproduzível** — `README.md:44-46`
  e `docs/ARCHITECTURE.md:98-100` prometem `prisma/migrations`, mas a pasta não
  existe; `db:deploy` não provisiona banco do zero. O operador fica sem caminho.
- **`db:seed` destrutivo** — `prisma/seed.ts:6-11` limpa todas as tabelas; quem
  roda o comando no banco da família perde os dados sem confirmação.
- **Histórico nunca aparece** — o seed cria só o mês corrente (`seed.ts:64-75`)
  enquanto o dashboard busca meses anteriores (`dashboard.ts:46-52`); a frase
  prometida no README/SPEC fica invisível e a tela trava em "Ainda não há
  histórico suficiente.".
- **Erro de banco disfarçado de leitura** — `src/app/page.tsx:25-35,64-69`: com
  `dbError` o `%`, os dias e o feedback continuam na tela; o usuário não distingue
  "não gastei nada" de "não há banco".
- **Estado "sem renda" sem orientação** — a SPEC §5.6 pede orientar o cadastro de
  entradas; a UI mostra `0%` cinza sem CTA/explicação.
- **Snapshots podem divergir do cálculo real** — se o seed gravar percentuais
  "no braço" e as transações mudarem, o `%` do mês e a frase comparativa podem se
  contradizer, minando a confiança no número (o alvo do produto).
- **README sem verificação e desatualizado** — não diz o que deve ser observado
  após `db:migrate`/`db:seed` nem que o seed é destrutivo; "Status: Projeto
  iniciado (Fase 0)" (`README.md:75-80`) já é falso.
- **Erros crus do Prisma** — env ausente/tabela inexistente retornam P1001/P2021
  em inglês, sem passo de correção.

## Recomendações priorizadas

- **P0 — versionar `prisma/migrations/0001_init`** e validar `db:migrate` +
  `db:seed` num Postgres limpo (garantir que `db:deploy` provisione do zero).
  Benefício: onboarding reproduzível; sem isso nada mais é demonstrável.
- **P0 — seed idempotente e não destrutivo** — `upsert` por chave natural (ou
  limpeza só atrás de flag `--reset`). Benefício: reexecutar é seguro.
- **P0 — seed cria 4 meses fechados + mês corrente de `MonthlySnapshot`**,
  idealmente **derivados das transações** (mesma fonte que o dashboard).
  Benefício: cumpre o critério de aceite e a promessa do README.
- **P0 — estados explícitos de vazio/erro/sem-histórico no dashboard** — em
  `dbError`, esconder o `%` e mostrar erro acionável; sem renda, orientar cadastro.
  Benefício: elimina leitura enganosa.
- **P1 — comando `db:snapshots` de backfill** que recalcula snapshots
  idempotentemente a partir das transações (consistência `%` × histórico).
- **P1 — README: passo a passo completo + verificação + aviso do seed** e
  corrigir o "Status". Benefício: o operador sabe se deu certo e o risco.
- **P2 — erros de migration/seed acionáveis** (traduzir P1001/P2021 em
  "defina DATABASE_URL"/"rode as migrations"). Benefício: menos suporte.

## Evidência

Executado nesta fase (nenhum arquivo de código alterado; working tree limpo antes
e depois, exceto este documento):

```
$ git branch --show-current
autoia/task-207
$ git status
nothing to commit, working tree clean

$ ls prisma/
schema.prisma  seed.ts          # NÃO existe prisma/migrations/
$ git ls-files prisma
prisma/schema.prisma
prisma/seed.ts

$ npm test
 ✓ src/lib/finance.test.ts (9 tests) 4ms
 Test Files  1 passed (1) / Tests  9 passed (9)
$ npm run typecheck   # (sem erros)
$ npm run build
 ✓ Compiled successfully ... Route (app) ƒ / ○ /login ƒ /api/auth/login ƒ /api/auth/logout

$ DATABASE_URL=<unset>; AUTOIA_HOST_SERVICES_BASE=http://127.0.0.1
$ pg_isready -h 127.0.0.1 -p 5432
127.0.0.1:5432 - accepting connections
$ PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -tAc "select 1"
FATAL: password authentication failed for user "postgres"
# → sem DATABASE_URL válida, migrations/seed reais não são validáveis neste sandbox.

$ FINFAM_USER=familia FINFAM_PASS=... FINFAM_SESSION_SECRET=... PORT=3101 npm start
$ curl -o /dev/null -w "%{http_code}" http://127.0.0.1:3101/          # sem sessão
307
$ curl -X POST -d '{"user":"familia","pass":"..."}' .../api/auth/login
{"ok":true} [200]
$ curl -b cookie http://127.0.0.1:3101/  → 200, contém:
0%
Ainda não há histórico suficiente
Banco de dados não configurado. Defina DATABASE_URL ... e rode as migrations ...
Sair (familia)
background-color:hsl(0 0% 45%)
```

Chave de leitura desta rodada: a task entrega infraestrutura, mas o efeito de
**onboarding/estado vazio** ainda é o mesmo da rodada anterior — o produto segue
sem caminho reproduzível para provisionar o banco e o dashboard continua mostrando
`0%`/"Ainda não há histórico suficiente." quando falta dado ou banco.
---

# Auditoria complementar — competência da fatura e rateio de parcelas (task #208)

> Foco: o impacto **para quem usa** do bug de competência de fatura
> (`src/lib/dashboard.ts:43-45` e `:59`) e das decisões em aberto (SPEC §3.4/§5.5).
> Nenhum código de produção foi alterado nesta fase; a leitura abaixo deriva do
> código, da SPEC e do estado real do build/testes.

## Fluxos do usuário (estado atual)

- **Abrir o dashboard (`/`)** — o número gigante `% da renda consumida`
  (`src/app/page.tsx:51-54`) é somado em `loadDashboardData` a partir de
  `cardPurchase` filtrado por `purchaseDate` no mês corrente e do `amountCents`
  integral (`src/lib/dashboard.ts:43-45,59`). Uma compra de 10/03 com fechamento 20
  deveria aparecer em abril (SPEC §3.4), mas aparece em março. O usuário vê um
  percentual plausível, porém deslocado ~1 mês, sem qualquer aviso.
- **Compra parcelada** — não há tela para cadastrá-la hoje (ver `/cartoes` em
  SPEC §6, inexistente), mas o modelo já suporta `installmentNumber`/
  `installmentsTotal` (`prisma/schema.prisma:95-96`). Quando existir, a compra 12x
  entrará **100% no mês da compra** e 0% nos 11 seguintes: a tela pode saltar de
  verde para vermelho no mês da compra e ficar artificialmente leve depois.
- **Compra no dia do fechamento / virada de ano** — o comportamento `>=` vs `>`
  não está fixado (SPEC diz "fechamento imediatamente posterior"): o usuário não
  consegue prever em que mês a compra vai cair.
- **Conferir a conta** — não existe tela de fatura/detalhe de compra nem seletor
  de mês (`/cartoes` e `/historico` planejados, inexistentes). O usuário não tem
  como explicar por que o número mudou ou a que fatura uma compra pertence.
- **Sem banco/sem dados** — a página mantém o `%` e só mostra o aviso discreto
  (`src/app/page.tsx:64-69`), como já apontado na auditoria anterior.

## Problemas de usabilidade

- **Número protagonista pode estar errado e é apresentado sem ressalva** — o rótulo
  é "Renda do mês consumida" (`src/app/page.tsx:46-48`) sem indicar a competência
  (mês de vencimento da fatura). O erro de ~1 mês se disfarça de leitura correta e
  leva a decisões de gasto equivocadas.
- **Parcelamento distorce o orçamento do mês da compra** — somar `amountCents`
  integralmente (`dashboard.ts:59`) ignora as parcelas; o usuário vê um pico falso
  e cores que não correspondem à realidade dos meses seguintes.
- **Regra de fechamento/vencimento é invisível na UI** — não há rótulo do tipo
  "fatura com vencimento em abril" nem indicação de parcela (x/12). O usuário não
  aprende nem confia na regra.
- **Impossível auditar ou corrigir a alocação** — sem `/cartoes`, não se vê
  fechamento, vencimento, parcela atual/total nem a fatura de destino; o bug fica
  invisível e não contestável pelo usuário.
- **Seed não reproduz o cenário** — `prisma/seed.ts:54-62` cria 1 compra à vista;
  não há parcelamento cruzando o ano nem cartão com `dueDay > closingDay`, logo a
  verificação manual no dashboard não evidencia a correção (nem o bug).
- **Estado vazio/erro enganoso (herdado)** — `0%` cinza e aviso de rodapé
  (`page.tsx:25-35,64-69`) podem ser lidos como "não gastou"; agrava um número já
  suscetível ao erro de competência.
- **Cor continua sendo o único sinal de estado** — um mês calculado errado muda a
  cor sem rótulo textual (ok/atenção/crítico), tornando o engano mais difícil de
  perceber por quem não distingue cores.

## Recomendações priorizadas

- **P0 — corrigir a competência e o rateio e, na mesma entrega, rotular a
  competência no dashboard** — exibir o mês de vencimento da fatura junto ao número
  (ex.: "fatura com vencimento em abril"). Torna a regra verificável e devolve
  confiança ao número protagonista.
- **P0 — travar o comportamento por testes (Vitest)** — parcelas, dia do
  fechamento, virada de ano: sem isso o usuário volta a ver mês errado a cada
  refatoração; é o critério de aceite da tarefa.
- **P1 — tela `/cartoes` com compras, parcela atual/total e fatura de destino** —
  permite entender e corrigir a alocação; transforma um cálculo opaco em dado
  auditável.
- **P1 — enriquecer o seed** com uma compra parcelada que cruze o ano e um cartão
  `dueDay > closingDay` — viabiliza validação manual real no dashboard.
- **P1 — estado vazio/erro explícito** (esconder o `%` e mostrar CTA de cadastro
  quando não há dados/DB) — elimina o falso positivo `0%` que hoje convive com o
  erro de competência.
- **P2 — `/historico` com seletor de mês e visão de parcelas futuras** — o usuário
  enxerga o impacto parcelado ao longo dos meses, hoje invisível.
- **P2 — rótulo textual do nível (ok/atenção/crítico) ao lado da cor** — reduz a
  dependência exclusiva da cor para perceber um cálculo errado.

## Evidência

Comandos e saídas reais desta fase (nenhum código de produção alterado; apenas
documentação):

```
$ git branch --show-current
autoia/task-208

$ git log --oneline -3
8cdde10 autoia: merge autoia/task-206
65c7a00 autoia: auditoria de usabilidade do FinFam (fase 2)
cf88b4f autoia: inicia projeto FinFam (estrutura Next.js, specs e testes)

$ npm test
 ✓ src/lib/finance.test.ts (9 tests) 4ms
 Test Files  1 passed (1)
      Tests  9 passed (9)

$ npm run typecheck
> tsc --noEmit
(sem erros)

$ npm run build
 ✓ Compiled successfully
Route (app) ...
┌ ƒ /           131 B   103 kB
├ ○ /login     1.05 kB  104 kB
└ ƒ /api/auth/{login,logout}
ƒ Middleware   39.7 kB
```

Leituras-chave: `src/lib/dashboard.ts:43-45` (filtro `purchaseDate` no mês) e
`:59` (soma `amountCents` integral); `src/app/page.tsx:46-54` (número e rótulo sem
competência); `prisma/seed.ts:54-62` (compra única à vista); `docs/SPEC.md:57-71`
(§3.4) e `:133-141` (§5); `docs/SPEC.md:146-159` (§6 — telas `/cartoes` e
`/historico` ainda inexistentes).

---

# Rodada 3 — Localizar no mês e manter dentro da renda (task #241)

> Fase 2 (auditor-ux) da task #241 ("Proposta de melhorias de usabilidade"). Foco:
> os fluxos que respondem **"onde estou no mês?"** e **"quanto ainda cabe?"** no
> dashboard e nas telas de lançamento. Baseada na leitura do código atual e na
> execução real de `npm test`, `npm run typecheck`, `npm run build` e de um repro
> do fuso BRT. Nenhum código de produção foi alterado — apenas este documento.

## Fluxos do usuário

- **Login (`/login`)** — formulário "Usuário/Senha", botão vira "Entrando...",
  distingue erro de configuração (`CONFIG_ERROR`, faixa âmbar acionável) de
  credencial errada (faixa vermelha) e redireciona para `/` no sucesso. Bom.
- **Primeiro acesso sem renda (`/`)** — mostra "Sem dados ainda" com CTA
  "Cadastrar entradas" (`page.tsx:130-150`), em vez do falso `0%` das rodadas
  anteriores. Resolve o vazio enganoso.
- **Dashboard mês corrente (`/`)** — `MonthSelector`, `%` gigante + rótulo textual
  do nível, `invoiceDueLabel` ("Fatura com vencimento em outubro/2026"),
  "N dias para o fim do mês", feedback comparativo, `QuickExpenseCard`,
  `DailyAllowanceCard` ("Pode gastar por dia"), dois gráficos, "Avaliação do dia",
  `MonthReviewPanel` e `PurchaseSimulator`.
- **Lançamento rápido (no dashboard)** — formulário inline Data/Descrição/Valor,
  "Salvando..." → "Gasto criado" (verde) ou erro de rede (vermelho) e
  `router.refresh()` (`QuickExpenseCard.tsx:30-71`). A data inicial vem de
  `todayISO()`.
- **Gastos (`/gastos`)** — seletor de mês (12 anteriores/próximos), lista, CRUD;
  o header usa `today = new Date().toISOString().slice(0,10)` (`gastos/page.tsx:49`)
  e o mês corrente vem de `currentMonthParam()` (UTC).
- **Histórico (`/historico`)** — `MonthSelector` e o **mesmo** número `%` em tela
  cheia (`historico/page.tsx:103-137`); não há tabela/lista dos meses anteriores
  nem a comparação em destaque.
- **Entradas/Saídas/Cartões/Configurações** — managers com estado vazio ("Nenhuma
  entrada cadastrada ainda"), mensagens de salvar/desativar e `SettingsForm` com
  sucesso temporário e erro acionável.
- **Erro e carregamento** — dashboard/histórico/gastos mostram `role="alert"` +
  `RetryButton` ("Tentar novamente"); há `loading.tsx` com skeleton (`aria-busy`).

## Problemas de usabilidade

- **Duas molduras de tempo concorrentes na mesma tela** — o `%`, o rótulo do nível
  e "N dias para o fim do mês" vêm do **mês calendário** (`computeFinanceStatus`,
  `finance.ts:297-342`; `monthKey(referenceDate)`, `page.tsx:41-45,185`), enquanto
  o card "Pode gastar por dia" usa o **ciclo** (`cycleStartDay`) e diz "N dias
  restantes no ciclo" (`cycle.ts:99-113,257`). Com `cycleStartDay = 20`, o usuário
  lê "12 dias para o fim do mês" ao lado de "24 dias restantes no ciclo" — não sabe
  qual janela governa o orçamento. É o núcleo de "me localizar no mês".
- **O card de diária mistura as duas janelas internamente** — `loadCycleAllowance`
  soma renda/obrigações do **mês calendário** (`dashboard.ts:185-191`) e divide os
  gastos por um intervalo diferente (`cycleWindow`). O valor exibido não
  corresponde nem ao mês nem ao ciclo, sem que o rótulo explique.
- **"Avaliação do dia" contradiz o orçamento real** — `rateDay` usa
  `renda / dias_no_mês` **sem descontar obrigações** (`day-rating.ts:36-42`;
  `dashboard-series.ts:118-119`), enquanto a diária e o `%` subtraem saídas fixas e
  faturas. Ex.: renda R$ 1.000, obrigações R$ 700, gasto hoje R$ 30 → badge "Ok",
  mas a diária real é ~R$ 10. Falso alívio contra "me manter dentro da renda".
- **Não existe "quanto ainda posso gastar" em R$** — `freeBudgetCents` é calculado
  (`cycle.ts:165-167`) e nunca exposto; `dailyAllowanceCard` só mostra a diária
  (`cycle.ts:190-259`). O usuário precisa multiplicar dias × diária de cabeça para
  saber o saldo do ciclo.
- **Projeção do mês é invisível** — `projectedPercent` é calculado
  (`finance.ts:326`) e usado só de forma implícita no texto comparativo
  (`finance.ts:402`); a tela nunca mostra "no ritmo atual você fecha o mês em Z%",
  justamente o número que permite corrigir a tempo.
- **Feedback não é acionável** — `compareWithHistory` só compara com meses
  anteriores (`finance.ts:356-372`); quando estoura, não diz o que fazer ("faltam
  N dias; ajuste para R$ Y/dia"). Não ajuda a *manter* dentro da renda.
- **Fuso UTC em `/gastos` e no lançamento rápido** — `todayISO` (`quick-expense.ts:37-39`),
  `today` (`gastos/page.tsx:49`), `currentMonthParam`/`monthRange`
  (`variable-expenses.ts:40-58`) usam UTC; o dashboard usa `America/Sao_Paulo`
  (`time.ts:10`). Repro real em 31/10/2026 23:30 BRT: `todayISO` = `2026-11-01`
  (amanhã) e `currentMonthParam` = `2026-11`, mas `monthKey` = `2026-10`. Após 21h
  o formulário abre com data de amanhã e a lista de gastos cai no mês errado.
- **`/historico` duplica o `%` e não entrega histórico** — a tela repete o número
  gigante do dashboard (`historico/page.tsx:103-137`) sem lista de meses, sem
  evolução e sem a frase comparativa em destaque. O usuário não consegue responder
  "como estive nos últimos meses".
- **Histórico pode divergir do cálculo atual** — `buildSnapshot` ignora vigência e
  conta cartão por `purchaseDate` (`snapshots.ts:60-75` vs `dashboard.ts:87-112`); a
  comparação depende de `db:snapshots` manual. Se divergir, o texto contradiz o `%`
  e a confiança no número protagonista cai.
- **"Avaliação do dia" e o rótulo do `%` usam a mesma palavra com bases diferentes**
  — ambos podem exibir "Ok" calculado de formas distintas (mês calendário vs
  renda/dias), gerando duas leituras "Ok" que discordam entre si.
- **Mês futuro navegável sem explicação** — `isCurrentMonth` é
  `referenceMonthKey >= currentMonthKey` (`page.tsx:43`), então o `input type="month"`
  permite ir para meses futuros; sem renda vigente cai em "Sem dados ainda /
  Cadastre suas entradas", mensagem errada para um mês que ainda não chegou.
- **Onboarding do ciclo sem explicar a consequência** — `SettingsForm.tsx:102-105`
  diz "Use o dia de fechamento do cartão", mas não avisa que isso separa a janela
  do card de diária da janela do `%`; o usuário muda o ciclo e vê dois números
  discordarem sem entender por quê.
- **Simulador silenciosamente troca por heurística local** — em falha da rota, o
  `PurchaseSimulator` mostra o resultado local como se fosse a resposta do servidor
  (`PurchaseSimulator.tsx:96-102`), sem indicar a degradação. Pode minar a confiança.

## Recomendações priorizadas

- **P0 — Corrigir o fuso de `/gastos` e do lançamento rápido** — trocar
  `toISOString().slice(0,10)` por helper zoned (`time.ts`) e tornar
  `currentMonthParam`/`monthRange` cientes de `resolveTimeZone`; teste cobrindo
  23:30 BRT e virada de mês. Benefício: o formulário para de abrir no dia/mês
  errado após 21h.
- **P0 — Alinhar `rateDay` ao orçamento livre** — passar a diária já líquida de
  obrigações; teste com obrigações altas provando que "Ok" só aparece dentro do
  orçamento real. Benefício: elimina o falso alívio que contraria a ideia.
- **P0 — Alinhar `buildSnapshot` ao `loadDashboardData`** (vigência + competência
  de fatura) e automatizar/`documentar db:snapshots`. Benefício: a comparação deixa
  de contradizer o `%`.
- **P1 — Unificar a moldura temporal do dashboard** — quando `cycleStartDay ≠ 1`,
  rotular `%`, "dias" e o card de diária com a **mesma** janela (ou recalcular o `%`
  sobre o ciclo); teste com `cycleStartDay` 1 e 20. Benefício: o usuário volta a
  saber em que mês está.
- **P1 — Exibir o saldo restante do ciclo em R$** — expor `freeBudgetCents` no
  `DailyAllowanceCard` ("Ainda tem R$ X até o fim do ciclo"). Benefício: responde
  "quanto ainda cabe" sem cálculo mental.
- **P1 — Mostrar a projeção do mês** — renderizar `projectedPercent` no card
  principal ("No ritmo atual: Z% até o fim do mês"). Benefício: permite corrigir
  antes de estourar.
- **P1 — Feedback acionável ao estourar** — nível ≥ laranja ou projeção ≥ 100% →
  plano "faltam N dias; ajuste para R$ Y/dia". Benefício: fecha o ciclo de "me
  manter dentro".
- **P2 — `/historico` como lista/evolução de meses** — tabela dos meses com `%` e
  total, em vez de repetir o número do dashboard. Benefício: responde "como estive".
- **P2 — Impedir/avisar navegação para mês futuro** e trocar a mensagem de vazio
  por uma adequada ao contexto. Benefício: menos leitura enganosa.
- **P2 — Texto de ajuda no `SettingsForm`** explicando o efeito do ciclo sobre o
  card de diária. Benefício: onboarding do conceito que hoje confunde.
- **P2 — Sinalizar no `PurchaseSimulator` quando o veredito é local** (degradação).
  Benefício: preserva a confiança na recomendação.

## Evidência

Comandos e saídas reais desta fase (nenhum arquivo de produção alterado; apenas
este documento):

```
$ git branch --show-current
autoia/task-241

$ git status
nothing to commit, working tree clean

$ git fsck --full --no-progress ; echo fsck_exit=$?
fsck_exit=0
$ ls .git/shallow 2>/dev/null || echo "not shallow"
not shallow
$ git rev-list --all --count
108

$ npm test 2>&1 | tail -6
 Test Files  40 passed (40)
      Tests  369 passed (369)
   Duration  1.73s
TEST_EXIT=0

$ npm run typecheck 2>&1 | tail -3
> tsc --noEmit
TYPECHECK_EXIT=0

$ npm run build 2>&1 | tail -6
├ ƒ /gastos ...
├ ƒ /historico ...
├ ○ /login ...
└ ƒ /saidas ...
BUILD_EXIT=0

$ node -e 'const ref=new Date("2026-10-31T23:30:00-03:00"); ...'
=== 31/10/2026 23:30 BRT ===
todayISO (UTC): 2026-11-01      # amanhã
SP day: 2026-10-31
currentMonthParam (UTC): 2026-11
monthKey (SP): 2026-10          # dashboard fica em outubro
```

Leituras-chave: `src/app/(app)/page.tsx:41-45,185` (mês calendário) vs
`src/components/DailyAllowanceCard.tsx:20-26` + `src/lib/cycle.ts:99-113,257`
(ciclo); `src/lib/day-rating.ts:36-42` e `src/lib/dashboard-series.ts:118-119`
(orçamento bruto); `src/lib/finance.ts:297-342,326,356-372,402` (projeção/
comparação); `src/lib/quick-expense.ts:37-39` e
`src/app/(app)/gastos/page.tsx:49` (UTC); `src/lib/snapshots.ts:60-75` vs
`src/lib/dashboard.ts:87-112` (vigência/competência); `src/app/(app)/historico/page.tsx:103-137`
(histórico duplica o `%`).

---

# Rodada 4 — Dashboard: média diária de consumo e categoria nos gráficos (task #250)

> Fase 2 (auditor-ux) da task #250 ("Melhorias de usabilidade e gráficos mais úteis
> no dashboard"). A retomada do usuário fixou a decisão de produto em aberto:
> **consumo = total de entradas − gastos fixos** deve ser a fonte de verdade das
> análises. Esta rodada avalia o **impacto na experiência** de introduzir essa
> métrica e a categoria nos gráficos, aposentar o "Dia a dia" e transformar o
> `/historico` em ferramenta de análise da família. Baseada na leitura do código
> atual e na execução real de `npm test`, `npm run typecheck`, `npm run lint` e de
> um cálculo repro dos números que o usuário verá na tela. Nenhum código de
> produção foi alterado — apenas este documento.

## Fluxos do usuário

- **Abrir o dashboard no mês corrente (`/`)** — vê o `%` protagonista ("Renda do
  mês consumida"), projeção ("No ritmo atual: Z% até o fim do mês"), "Mês
  calendário", rótulo textual do nível, vencimento de fatura, contador do **ciclo**,
  feedback comparativo, `QuickExpenseCard`, `DailyAllowanceCard` ("Pode gastar por
  dia", diária do ciclo), dois gráficos, "Avaliação do dia", `MonthReviewPanel` e
  `PurchaseSimulator`. Muita informação, mas os números não compartilham a mesma
  moldura temporal nem o mesmo conceito de gasto.
- **Interpretar os gráficos** — `IncomeVsExpenseChart` mostra só dois totais
  (Entradas × Saídas) em barras proporcionais; `DailySpendChart` ("Dia a dia") plota
  uma barra por dia (fixas + avulsos + fatura) e uma linha de acumulado, sem eixos,
  sem escala em R$, sem legenda e sem linha de referência. O usuário não consegue
  responder "quanto gastei de verdade por dia nem se estou dentro do ritmo".
- **Lançar um gasto (Lançamento rápido)** — formulário Data/Descrição/Valor, sem
  campo **categoria** (`QuickExpenseCard.tsx:82-142`). O gasto criado aqui entra
  como `null` e, no novo gráfico de categoria, viraria "Sem categoria".
- **Cadastrar categoria** — só em `/gastos`, `/saidas` e `/cartoes`, como **texto
  livre** (ex.: `GastosManager.tsx:439`, `FixedItemsManager.tsx:430`,
  `CreditCardsManager.tsx:1288`), sem lista, sugestão ou normalização. Duas pessoas
  escrevem "Mercado", "mercado" e "supermercado" e viram três fatias.
- **Consultar o histórico (`/historico`)** — há `MonthSelector` e o **mesmo** `%`
  em tela cheia (`historico/page.tsx:111-144`); não há lista de meses, tendência,
  comparativo por categoria nem consumo. O seletor de mês muda o número mostrado,
  mas não há visão temporal: "como estivemos nos últimos meses" segue sem resposta.
- **Navegar para mês futuro** — permitido pelo `input type="month"`; cai na
  mensagem genérica de vazio (herdado da rodada anterior), sem explicar que o mês
  ainda não chegou.
- **Buscar ajuda para a família** — hoje apenas a frase comparativa do card e o
  `MonthReviewPanel` (IA opcional, mês fechado). Não existe nenhuma leitura por
  categoria nem resumo de "consumo médio por dia".

## Problemas de usabilidade

- **Três leituras diárias discordantes na mesma tela** — com renda R$ 5.000, fixas
  R$ 3.000, fatura R$ 1.000 e avulsos R$ 400: o `%` protagonista mostra 88%
  (`consumedCents` inclui fixas e fatura, `finance.ts:137-143`); o card de diária
  mostra **R$ 32,26/dia** (`(renda − fixas − faturas)/dias`,
  `dashboard-series.ts:134-136`); e o novo "consumo" pedido pelo usuário dá
  **R$ 64,52/dia** (`(entradas − fixas)/dias`). Sem rótulo que explique a diferença,
  o usuário vê três números "certos" que se contradizem.
- **O "Dia a dia" é inútil exatamente como o usuário descreveu** — os vencimentos
  dominam a escala: um fixo de R$ 3.000 no dia 10 esmaga um avulso real de R$ 400
  no dia 5 para **13,3% da altura do pico**; a fatura no vencimento cria outro pico.
  O gráfico não mostra valor por dia, não tem eixo, legenda, média nem separação
  fixas × variáveis (`DailySpendChart.tsx:78-108`). Não responde nada.
- **Gráfico de categoria nasce inviável sem noção de categoria no fluxo** — o
  lançamento rápido não tem categoria e a categoria é texto livre/opcional; o
  resultado prático é uma fatia "Sem categoria" grande e fatias fragmentadas. O
  gráfico pode ser tecnicamente correto e ainda assim inútil para a família.
- **Fatura de cartão é o caso mais fácil de divergir** — a categoria vive na
  `CardPurchase` e a parcela é alocada por competência (`invoices.ts:105-121`,
  `dashboard.ts:101-113`). Se a agregação somar a compra inteira (ou no mês da
  compra) o total por categoria não fecha com o total do mês; se ignorar a
  categoria, cai em "Sem categoria". Nos dois casos o usuário perde a confiança no
  gráfico.
- **Consumo negativo não tem tratamento de UX definido** — quando as fixas superam
  as entradas, `(entradas − fixas)/dias` fica negativo. Sem decisão explícita, a
  média pode aparecer negativa ou zerada sem explicação ("sua renda não cobre nem
  as contas fixas" é a mensagem que falta).
- **A categoria não é o único dado em falta no gráfico vazio** — não há estado
  "ainda sem gastos/ categorias neste mês" projetado para os novos gráficos; o
  padrão atual (barras zeradas) some silenciosamente em vez de orientar.
- **Acessibilidade dos gráficos atuais é fraca e seria herdada** — o `aria-label`
  do "Dia a dia" só anuncia "total de X" (`DailySpendChart.tsx:19-30`), sem os
  picos; as barras dependem de duas cores sem legenda textual; não há texto/tabela
  alternativa. Quem usa leitor de tela não obtém a informação do gráfico.
- **Não há onboarding do novo conceito** — nenhum texto explica que "Renda do mês
  consumida" (inclui fixas) passa a conviver com "consumo médio por dia" (exclui
  fixas). Sem isso, a métrica nova parece um erro de cálculo, não uma melhoria.
- **Moldura temporal implícita** — o card de diária usa o **ciclo**
  (`cycleStartDay`), o `%` e os gráficos usam o **mês calendário**. A média diária
  de consumo precisa declarar a janela; caso contrário a comparação
  média × realizado mistura duas réguas.
- **Ajuda à família inexistente** — não há resumo acionável ("sua média é R$ X/dia;
  hoje você gastou 1,5× isso") nem destaque de categoria acima do normal. O
  `/historico` não serve de base por ser só um número repetido.

## Recomendações priorizadas

- **P0 — Fixar e rotular a métrica na UI**: adotar `consumo = entradas − gastos
  fixos` como fonte de verdade, exibindo um subtítulo explícito ("Consumo médio por
  dia — não inclui contas fixas nem faturas") ao lado do `%`. Benefício: elimina a
  contradição dos três números e o risco de o usuário achar que um deles está errado.
- **P0 — Aposentar o "Dia a dia"** por um gráfico de **gasto variável por dia +
  linha da média diária de consumo**, com as fixas/faturas como faixa ou anotação
  à parte (não como barra). Benefício: atende literalmente a queixa (os fixos
  atrapalham) e os picos de vencimento somem.
- **P0 — Levar a categoria ao fluxo de lançamento**: campo com `datalist` de
  categorias sugeridas (reaproveitando as já usadas) + opção "Sem categoria" tanto
  no `QuickExpenseCard` quanto em `/gastos`. Benefício: o gráfico de categoria tem
  dado confiável; sem isso ele não se sustenta.
- **P0 — Garantir coerência do gráfico de categoria com o total**: faturas pela
  competência da parcela e categoria da `CardPurchase`; `null`/vazio agrupado em
  "Sem categoria"; soma das fatias == total do mês (teste). Benefício: o número do
  gráfico bate com o `%` e o usuário confia.
- **P1 — Estados de vazio/erro próprios de cada gráfico**: "Ainda sem gastos neste
  mês", "Sem categorias cadastradas" com CTA para `/gastos`. Benefício: o gráfico
  vazio orienta em vez de parecer quebrado.
- **P1 — `/historico` como análise real**: lista dos últimos meses (consumo, `%`,
  total) + gráfico de tendência + comparativo por categoria. Benefício: entrega o
  "como estivemos" e a base para a ajuda à família.
- **P1 — Mensagens acionáveis de ajuda à família**: "sua média é R$ X/dia; hoje
  variou Y", "a categoria Alimentação ficou 40% acima da média dos últimos meses",
  resumo do ciclo. Benefício: transforma gráficos em decisão.
- **P1 — Tratar consumo ≤ 0 com mensagem clara**: quando as fixas consomem toda a
  renda, exibir "sua renda não cobre as contas fixas" em vez de média negativa/zero
  muda. Benefício: explica o caso extremo sem confundir.
- **P2 — Acessibilidade dos gráficos**: legenda textual, valores por dia no
  `aria-label`, descrição/tabela alternativa e contraste; nunca depender só da cor.
  Benefício: leitores de tela e daltonismo acessam a mesma informação.
- **P2 — Normalizar categorias**: trim/casefold + sugestões (ou enum com migração
  do texto livre legado). Benefício: fatias estáveis ao longo do tempo.
- **P2 — Padronizar a moldura temporal**: rotular explicitamente se a média/categoria
  é do mês calendário ou do ciclo (`cycleStartDay`). Benefício: comparações válidas.
- **P2 — Bloquear/avisar mês futuro** com mensagem adequada. Benefício: menos
  leitura enganosa (item herdado, ainda aberto).

## Evidência

Comandos e saídas reais desta fase (nenhum código de produção alterado; apenas este
documento). Baseline da branch `autoia/task-250` antes da alteração:

```
$ git branch --show-current
autoia/task-250
$ git status --short
(limpo, antes deste documento)

$ npm test 2>&1 | tail -6
 Test Files  47 passed (47)
      Tests  469 passed (469)
   Duration  5.00s
TEST_EXIT=0

$ npm run typecheck 2>&1 | tail -4
> tsc --noEmit
TYPECHECK_EXIT=0

$ npm run lint 2>&1 | tail -6
  17:36  warning  '_omitted' is assigned a value but never used
✖ 1 problem (0 errors, 1 warning)
LINT_EXIT=0
```

Repro dos números que o usuário veria com renda R$ 5.000, fixas R$ 3.000, fatura
R$ 1.000, avulsos R$ 400 (outubro, 31 dias):

```
$ node -e '...'
protagonista consumedCents = 440000 => 88% da renda
consumo proposto (entradas-fixas) = 200000 => media diaria 64.52 R$/dia
dailyFreeBudget atual = (renda-fixas-faturas)/dias = 32.26 R$/dia
Dia a dia: pico barra = 3000.00 R$ no dia 10 | avulso no dia 5 = 400.00 R$ (escala esmagada: 13.3% do pico)
```

Leituras-chave desta rodada: `src/lib/finance.ts:137-143,299-344` (`consumedCents`/`%`
com fixas e a projeção); `src/lib/dashboard-series.ts:113-142` (série mistura fixas +
faturas; `dailyFreeBudgetCents` desconta fixas **e** cartão);
`src/components/DailySpendChart.tsx:19-30,78-108` (sem referência/legenda/valores);
`src/components/IncomeVsExpenseChart.tsx:24-60` (só dois totais);
`src/components/QuickExpenseCard.tsx:82-142` (sem categoria);
`src/components/GastosManager.tsx:439` / `FixedItemsManager.tsx:430` /
`CreditCardsManager.tsx:1288` (categoria texto livre);
`src/lib/dashboard.ts:101-123` (rateio de fatura por competência);
`src/app/(app)/historico/page.tsx:111-144` (placeholder);
`src/components/DailyAllowanceCard.tsx:18-32` (diária do ciclo) e
`src/lib/cycle.ts:230-315` (rótulos da diária); `docs/DASHBOARD_CHARTS.md` (diretriz).

# Rodada 5 — Propostas independentes de usabilidade (task #259)

> Fase 2 (auditor-ux) da task #259 ("propostas de melhorias de usabilidade que
> agreguem valor e facilidade à família, **sem encadear**: cada proposta completa
> por si só"). Avaliação dos fluxos, feedback visual, clareza de textos,
> consistência e onboarding do estado atual (branch `autoia/task-259`, após as
> tasks #241/#250/#257/#258). Toda recomendação abaixo foi validada no código e é
> **autocontida** — nenhuma depende de outra. Rodadas 1–4 são histórico; os itens
> que elas apontam e que já foram entregues **não** são repetidos aqui. Baseada na
> leitura do código e na execução real de `typecheck`, `lint`, `test` e `build`.
> Nenhum código de produção foi alterado — apenas este documento.

## Fluxos do usuário

- **Login (`/login`)** — "Usuário/Senha" com `autoComplete="username"` e
  `autoComplete="current-password"` (`src/app/login/page.tsx:81,93`), botão que
  vira "Entrando...", erro em faixa `role="alert"`. Funciona e os gerenciadores de
  senha preenchem (corrige a tarefa 7 da Fase 1: a checagem de lá foi
  case-sensitive e não achou `autoComplete`).
- **Dashboard (`/`)** — `%` + rótulo textual do nível, projeção, contador do ciclo,
  `QuickExpenseCard` (com "Gasto criado" em `role="status"`), gráficos com legenda,
  `FamilyHelpCard` (insights + resumo IA com fallback local), estados
  vazio/erro/carregando próprios com CTA (`emptyStateCopy`, `finance.ts:706+`).
  Mês futuro mostra `FutureMonthNotice` (`page.tsx:244`).
- **Navegar o mês em `/gastos` e `/entradas`** — `<select>` montado por
  `buildMonthOptions` com 25 opções (−12…+12 meses). Para um mês futuro o usuário
  vê "Nenhum gasto em <mês futuro>. Lance o primeiro." (`GastosManager.tsx:521`) /
  "Nenhuma entrada avulsa em <mês futuro>." (`ExtraIncomesManager.tsx:415`) e o
  formulário de lançamento liberado — **sem** `FutureMonthNotice`, que só existe em
  `/` e `/historico`.
- **Lançar gasto com data em outro mês** — o formulário sempre pré-preenche
  `date = hoje` (`GastosManager.tsx:69`), independentemente do mês selecionado. Em
  `/entradas` o save fora do mês visível avisa ("Entrada criada para outro mês
  (…)", `ExtraIncomesManager.tsx:200-204`) e faz `router.refresh()`; em `/gastos` o
  item é filtrado da lista e a faixa mostra só **"Gasto criado"**
  (`GastosManager.tsx:250-259`) — ele não aparece e o usuário não sabe onde foi.
- **Excluir lançamentos** — `/gastos` (`GastosManager.tsx:292,563`) e entradas
  avulsas (`ExtraIncomesManager.tsx:215,440`) excluem **sem confirmação** no clique
  (não há undo). `/saidas` e entradas fixas usam desativação reversível
  (`FixedItemsManager.tsx:345 "Desativar"`); compras de cartão confirmam
  (`CreditCardsManager.tsx:530`). Há **1** `window.confirm` em todo `src/`.
- **Feedback de CRUD** — todos os managers têm faixa `role="status"`/`role="alert"`,
  botão "Salvando..."/"Excluindo..." com `aria-busy`, sucesso que some em 4 s, erro
  com "Tentar novamente" (`RetryButton`). Padrão consistente e bom.
- **Onboarding/glossário** — inexistente como tela. O único texto conceitual é o
  microtexto `CYCLE_START_HELP` (`SettingsForm.tsx:12-13`). "Competência da fatura",
  "% da renda consumida" × "consumo disponível" e o significado dos níveis de cor
  não têm explicação acessível em nenhuma rota (não há `/ajuda`).
- **Atualização do PWA** — `ServiceWorkerRegister.tsx:8` só chama `register()`; não
  há listener de `updatefound`/`controllerchange` nem prompt "Nova versão
  disponível". O `sw.js` faz `skipWaiting()` no install (`:97`), `clients.claim()`
  no activate (`:111`) e **apaga os caches antigos** (`:108-110`) — abas abertas com
  HTML antigo perdem os chunks lazy e recebem 404 até o reload.
- **Qualidade da entrega** — o gate `typecheck && lint && test && build` (AGENTS.md)
  só roda manualmente: `.github/` não existe e as 9 suítes
  `*.integration.test.ts` nunca rodaram (sem `TEST_DATABASE_URL` em pipeline).

## Problemas de usabilidade

- **P0 — Exclusão irreversível sem confirmação em `/gastos` e entradas avulsas** —
  o clique em "Excluir" (`GastosManager.tsx:563`, `ExtraIncomesManager.tsx:440`)
  dispara `DELETE` na hora; no tablet, toque acidental apaga lançamento sem volta
  e sem undo. Inconsistente com `/cartoes` (confirma) e `/saidas` (desativa).
- **P0 — Mês futuro em `/gastos`/`/entradas` convida a lançar em mês que não
  começou** — o vazio "Lance o primeiro." não explica o estado (padrão entregue em
  `/` e `/historico` não foi replicado); o usuário cria dado em mês futuro achando
  que a tela está quebrada.
- **P0 — "Gasto criado" enganoso quando a data cai em outro mês** — com o mês
  selecionado ≠ mês da data (padrão: data = hoje), `/gastos` filtra o item salvo da
  lista e só anuncia sucesso (`GastosManager.tsx:250-259`); `ExtraIncomesManager`
  já resolve com mensagem própria (`:200-204`). Mesma situação, feedbacks
  diferentes — a família não encontra o gasto que acabou de criar.
- **P1 — Sem glossário/onboarding dos conceitos** — ciclo × mês calendário,
  "competência da fatura", "% da renda consumida" × "consumo disponível" e níveis de
  cor só existem implícitos no código (`CYCLE_START_HELP`, `finance.ts`,
  `dashboard-series.ts`). Sem explicação, os rótulos do dashboard parecem
  contraditores — maior atrito de interpretação para a família.
- **P1 — Navegação de mês duplicada e sem teste** — `addMonths`/`buildMonthOptions`
  copiados em `gastos/page.tsx:23-39` e `entradas/page.tsx:26-34`, e `gastos` ainda
  reimplementa a virada de ano que já existe testada em `shiftMonthKey`
  (`finance.ts:90`). Viola o AGENTS.md; as duas telas podem divergir (uma com aviso
  de mês futuro, outra sem) — é dívida que gera bug de UI.
- **P2 — PWA sem fluxo de atualização** — com `skipWaiting`+`claim` forçados e
  caches antigos apagados, deploy novo + aba antiga = chunk 404 e erro em runtime,
  sem nenhum prompt de recarregar; o usuário vê a tela "quebrar" após atualização.
- **P2 — Sem CI versionada** — `.github/` ausente; nenhum gate automático protege
  os 682 testes e as 9 suítes de integração (que exigem Postgres) nunca rodam.
- **P3 — Dívidas de documentação/higiene** — `docs/USABILITY_AUDIT.md` acumulava 4
  rodadas com constatações superadas (esta rodada corrige isso); warning de lint
  pré-existente `env.test.ts:17` (`_omitted`).
- **Verificado e NÃO é problema (corrige a Fase 1)** — login **já** tem
  `autoComplete` (`login/page.tsx:81,93`); a checagem da Fase 1 foi case-sensitive
  (`grep "autocomplete"` não acha `autoComplete`). A tarefa 7 da Fase 1 deve ser
  descartada; opcionalmente só adicionar `name` nos inputs.

## Recomendações priorizadas

Cada item abaixo é **independente** (nenhum depende de outro), com escopo fechado
e critério de aceite testável — nesta ordem por impacto × esforço.

- **R1 (P0) — Confirmação de exclusão em `/gastos` e entradas avulsas** — função
  pura `deleteConfirmMessage()` em `src/lib` (pt-BR, com a descrição do item) +
  `window.confirm` em `GastosManager` e `ExtraIncomesManager` no padrão de
  `CreditCardsManager.tsx:530`; teste unitário dos textos + `renderToStaticMarkup`.
  Benefício: elimina perda de dado irreversível no toque acidental do tablet.
- **R2 (P0) — Aviso de mês futuro em `/gastos` e `/entradas`** — quando
  `mes > currentMonthParam()`, renderizar `FutureMonthNotice` (já existente e
  testado) com a frase "Este mês ainda não começou."; condição em função pura
  testada. Benefício: para de convidar lançamento em mês que não começou e torna as
  telas consistentes com `/` e `/historico`.
- **R3 (P0) — Mensagem de "criado em outro mês" em `/gastos`** — reaproveitar o
  padrão já entregue em `ExtraIncomesManager.tsx:200-204` (extrair para função pura
  compartilhada, ex.: `savedInOtherMonthMessage(mesSalvo, label)`, com teste dos
  textos exatos) e aplicar em `GastosManager`. Benefício: sucesso nunca aparece sem
  o item visível; elimina a inconsistência entre as duas telas de lançamento.
- **R4 (P1) — Glossário in-app** — página `/ajuda` (ou seção em `/configuracoes`)
  cujo conteúdo é função pura em `src/lib/glossary.ts` (ciclo × mês calendário,
  competência de fatura, "% da renda consumida" × "consumo disponível", níveis de
  cor) com teste dos textos exatos; a página server component só renderiza.
  Benefício: resolve o eixo de onboarding mais frágil sem tocar em nenhuma outra
  tela — "facilidade para a família" direta.
- **R5 (P1) — Extrair `addMonths`/`buildMonthOptions` para
  `src/lib/month-navigation.ts`** — remover a duplicação das duas páginas,
  reaproveitando `shiftMonthKey` já testado; testar virada de ano e as 25 opções.
  Benefício: impede divergência futura entre as telas (é o que torna R2 barato de
  manter), sem mudar comportamento visível hoje.
- **R6 (P2) — Fluxo de atualização do service worker** — em
  `ServiceWorkerRegister.tsx` escutar `updatefound`/`controllerchange` e mostrar
  "Nova versão disponível — Atualizar" (mensagem via função pura testada; no clique,
  `skipWaiting` + reload). Benefício: fecha o ciclo do PWA e evita tela quebrada
  pós-deploy no tablet.
- **R7 (P2) — Pipeline de verificação CI** — `.github/workflows/ci.yml` com
  `typecheck && lint && test && build` + job de integração com serviço Postgres e
  `TEST_DATABASE_URL` rodando `npm run test:integration`. Benefício: protege os 682
  testes e finalmente executa as 9 suítes de banco.
- **R8 (P3) — Higiene** — corrigir o warning `src/lib/env.test.ts:17` (`_omitted`)
  e manter este documento marcando o que já foi entregue por rodada. Benefício:
  lint limpo e auditorias futuras que não reabrem itens resolvidos.

**Sugestões opcionais (só quando nenhuma concreta estiver aberta):** entrada rápida
de receita no dashboard (hoje só há despesa via `QuickExpenseCard`), card
"Próximos vencimentos" (fixas + fatura ordenadas pelo dia do ciclo), busca/filtro
por descrição em `/gastos`, tabela alternativa para `DailyConsumptionChart`
(padrão já existe em `CategoryBreakdownCard.tsx`), leitura offline do último
dashboard com carimbo de horário (muda decisão de privacidade do `sw.js` — exige
decisão de produto).

## Evidência

Comandos e saídas reais desta fase (nenhum código de produção alterado; apenas este
documento):

```
$ git branch --show-current && git status --short
autoia/task-259            # (vazio antes deste documento)

$ npm run typecheck   → TYPECHECK_EXIT=0
$ npm run lint        → 0 errors, 1 warning (src/lib/env.test.ts:17 '_omitted') | LINT_EXIT=0
$ npm test            → Test Files 68 passed (68) | Tests 682 passed (682) | TEST_EXIT=0
$ npm run build       → BUILD_EXIT=0 (rotas / /cartoes /configuracoes /entradas
                         /gastos /historico /login /offline /saidas; Middleware 39.7 kB;
                         First Load JS 103 kB)
```

Checagens-chave desta rodada:

```
$ grep -rn "confirm(" src | wc -l
1                                   # só CreditCardsManager.tsx:530 (compra)
$ grep -ni "autocomplete" src/app/login/page.tsx
81:  autoComplete="username"
93:  autoComplete="current-password"  # Fase 1 dizia "ausente" (grep case-sensitive)
$ grep -rn "FutureMonthNotice" src | grep -v test
→ HistoryView.tsx:2,42 · FutureMonthNotice.tsx:1 · (app)/page.tsx:27,244
$ grep -n "FutureMonthNotice" "src/app/(app)/gastos/page.tsx" "src/app/(app)/entradas/page.tsx"
→ (nenhum)
$ grep -n "buildMonthOptions\|function addMonths" "src/app/(app)/gastos/page.tsx" "src/app/(app)/entradas/page.tsx"
→ gastos:23 addMonths, 31 buildMonthOptions | entradas:26 buildMonthOptions
$ grep -n "export function shiftMonthKey" src/lib/finance.ts
90: já existe e é testado (finance.test.ts) — gastos/page.tsx reimplementa
$ sed -n '250,259p' src/components/GastosManager.tsx
→ filtra item fora do mês e mostra só "Gasto criado"
$ sed -n '194,204p' src/components/ExtraIncomesManager.tsx
→ "Entrada criada para outro mês (…)" + router.refresh()
$ grep -n "skipWaiting\|clients.claim\|CACHE_NAME" public/sw.js
→ 15 CACHE_NAME | 97 skipWaiting() | 108-111 apaga caches antigos + claim()
$ grep -n "register(" src/components/ServiceWorkerRegister.tsx
8: só register(); sem updatefound/controllerchange
$ ls .github
ls: não foi possível acessar '.github': Arquivo ou diretório inexistente
$ grep -rn "window.confirm\|Desativar" src/components
→ 1 confirm (CreditCardsManager:530) · FixedItemsManager:345 usa "Desativar"
$ grep -rn "/ajuda" src/app → (rota não existe; único texto conceitual:
  sed -n '12,13p' src/components/SettingsForm.tsx → CYCLE_START_HELP)
```

Leituras-chave desta rodada: `src/components/GastosManager.tsx:69,250-259,292,521,563`;
`src/components/ExtraIncomesManager.tsx:194-204,215,415,440`;
`src/components/FixedItemsManager.tsx:345`;
`src/components/CreditCardsManager.tsx:530`;
`src/app/(app)/gastos/page.tsx:23-39` · `src/app/(app)/entradas/page.tsx:26-34`;
`src/lib/finance.ts:90` (`shiftMonthKey`) · `src/lib/finance.ts:706+` (`emptyStateCopy`);
`src/app/login/page.tsx:81,93`; `src/components/ServiceWorkerRegister.tsx:8`;
`public/sw.js:97,108-111`; `src/components/SettingsForm.tsx:12-13`;
`src/lib/env.test.ts:17`.

