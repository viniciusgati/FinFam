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

