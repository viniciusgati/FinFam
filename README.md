# FinFam

PWA de controle financeiro residencial. A família consulta, em um tablet ou
dashboard, **quanto ainda dá para gastar no mês** — sem exibir valores, apenas
**percentuais** — com a cor de fundo variando do verde ao vermelho conforme a
situação dos gastos.

## Visão geral

- Entradas fixas (salários) e saídas fixas (contas).
- Gastos avulsos (lançamentos do dia a dia).
- Cartão de crédito: compras e faturas contam como saída.
- Dashboard com **% da renda consumida**, **dias para o fim do mês** e um
  feedback comparativo com os últimos meses (ex.: _"Estão melhores que os
  últimos 4 meses"_).
- Autenticação simples por variáveis de ambiente (`FINFAM_USER` / `FINFAM_PASS`).

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** para o dashboard
- **Prisma ORM** + **PostgreSQL**
- **PWA** via manifest + service worker (instalável no tablet)
- **Vitest** para testes unitários e de integração
- Sessão via cookie `httpOnly` assinado com **jose**

Detalhes de arquitetura e regras em [`docs/`](./docs):

- [`docs/SPEC.md`](./docs/SPEC.md) — especificação funcional
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — arquitetura técnica

## Como rodar

Pré-requisitos: Node.js 20+ e um PostgreSQL acessível.

Do zero, em 5 comandos:

```bash
# 1. instalar dependências
npm install

# 2. configurar variáveis de ambiente
cp .env.example .env
# edite .env com DATABASE_URL e credenciais FINFAM_*

# 3. criar o schema (6 tabelas + enum PaymentMethod)
npm run db:migrate

# 4. popular dados de exemplo (5 snapshots: 4 meses fechados + mês corrente)
npm run db:seed

# 5. desenvolvimento
npm run dev
# abra http://localhost:3000 e autentique com FINFAM_USER / FINFAM_PASS
```

**O que observar após cada comando:**

| Comando | O que confere |
| --- | --- |
| `npm install` | termina com exit 0, sem erro de resolução de pacotes |
| `npm run db:migrate` | exit 0; na 1ª execução imprime `The following migration(s) have been applied:` com o nome da migration (ex.: `20261006121852_init`) e fecha com `Your database is now in sync with your schema.`; `SELECT to_regclass('public.monthly_snapshots')` retorna valor não nulo e as 6 tabelas (`incomes`, `fixed_expenses`, `credit_cards`, `variable_expenses`, `card_purchases`, `monthly_snapshots`) existem — reexecutar é seguro: com tudo aplicado também termina exit 0 sem alterar o banco, imprimindo `Already in sync, no schema change or pending migration was found.` |
| `npm run db:seed` | exit 0 e a saída termina com **`Seed concluído.`**; `SELECT count(*) FROM monthly_snapshots` = **5** e `SELECT "monthKey" FROM monthly_snapshots ORDER BY "monthKey";` lista o mês corrente + os 4 anteriores contíguos (sem buracos), com `incomes` = 2, `fixed_expenses` = 3, `credit_cards` = 1, `variable_expenses` = 2, `card_purchases` = 1 |
| `npm run dev` | a tela `/` autenticada responde 200 e a faixa de feedback traz o **comparativo com os 4 meses fechados do seed**, com o `%` do mês e o fundo colorido — nunca mais "Ainda não há histórico suficiente.". O texto da faixa segue a regra de projeção da SPEC §4.3 (`dashboardView` compara o **% projetado** do mês com os meses fechados): em 06/10/2026, com o seed, o observado foi **"Estão piores que os últimos 4 meses."** (ritmo projetado ≈ 120% > 33–37% dos meses fechados) — perto do fim do mês, com o mesmo seed, a mensagem vira "Estão melhores que os últimos 4 meses.". Com o banco **migrado sem seed**, `/` também responde 200 e mostra o estado vazio desenhado ("Sem dados ainda" + CTA de cadastro), sem tela de erro |

> **Dados de exemplo:** o seed popula rendas, contas, cartão e gastos de
> exemplo. Ele é **idempotente no mesmo mês** — reexecutar não duplica nem
> apaga nada (cada linha é atualizada pela sua chave natural). Para **apagar
> tudo** e recomeçar use `npm run db:seed -- --reset`, que é o único caminho
> destrutivo e imprime `Banco reiniciado com dados de exemplo. Seed concluído.`

## Se algo falhar

| Erro (código do Prisma) | O que fazer |
| --- | --- |
| `P1001` — *Can't reach database server* | o PostgreSQL não respondeu: confira o servidor e a `DATABASE_URL` no `.env` (host, porta, banco) e rode o comando de novo |
| `P2021` — *The table ... does not exist* | as migrations ainda não foram aplicadas: rode `npm run db:migrate` e repita `npm run db:seed` |
| `db:seed` antes do `db:migrate` | a saída **não** contém `Seed concluído.` e o exit é ≠ 0 — rode `npm run db:migrate` e repita o seed |

`npm run db:deploy` aplica as mesmas migrations em produção (`prisma migrate
deploy`), sem o passo interativo do `db:migrate`; com tudo já aplicado imprime
`No pending migrations to apply.` e termina exit 0.

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run start` | inicia o build de produção |
| `npm run typecheck` | checagem de tipos (`tsc --noEmit`) |
| `npm run lint` | análise estática com ESLint (`eslint .`) |
| `npm test` | testes unitários (Vitest); não executa `*.integration.test.ts` |
| `npm run test:integration` | testes de integração contra um PostgreSQL de teste (`TEST_DATABASE_URL`) |
| `npm run db:migrate` | cria/aplica migrations em dev (`prisma/migrations/`) |
| `npm run db:deploy` | aplica migrations em produção |
| `npm run db:seed` | popula o banco com dados de exemplo (idempotente no mesmo mês) |
| `npm run db:seed -- --reset` | **apaga tudo** e recria os dados de exemplo |
| `npm run db:snapshots` | deriva e grava os `monthly_snapshots` a partir das transações (idempotente) |
| `npm run db:studio` | Prisma Studio |

### Testes de integração

Os testes unitários (`npm test`) rodam offline e não tocam o banco. Já as
suítes `*.integration.test.ts` usam um PostgreSQL **dedicado de teste** apontado
por `TEST_DATABASE_URL` (nunca SQLite) e são executadas por:

```bash
TEST_DATABASE_URL="postgresql://user:pass@host:5432/finfam_test?schema=public" \
  npm run test:integration
```

Sem `TEST_DATABASE_URL`, `npm run test:integration` **falha com uma mensagem
explícita** (não pula em silêncio); `npm test` simplesmente ignora os arquivos
`*.integration.test.ts`. O helper `src/test/integration.ts` conecta via Prisma e
expõe `resetDatabase()`/`truncateAllTables()` para limpar as tabelas entre os
casos.

## Variáveis de ambiente

Veja [`.env.example`](./.env.example). Principais:

- `DATABASE_URL` — conexão PostgreSQL.
- `TEST_DATABASE_URL` — conexão PostgreSQL dedicada às suítes de integração
  (`npm run test:integration`); opcional, apenas para testes.
- `FINFAM_USER` / `FINFAM_PASS` — credenciais de acesso da família.
- `FINFAM_SESSION_SECRET` — segredo para assinar o cookie de sessão.

## Status

Fundação de dados pronta: `prisma/migrations/` versionada (6 tabelas + enum
`PaymentMethod`), seed idempotente com histórico de 5 meses contíguos (4
fechados + mês corrente) e o dashboard exibindo o feedback comparativo com a
regra de projeção da SPEC §4.3. Também entregues: CRUD de entradas e saídas
fixas, de gastos avulsos e de cartões/compras (com competência de fatura),
shell de navegação interna e os estados vazio/erro/carregando do dashboard.
`npm test` e `npm run typecheck` verdes. Falta apenas a tela `/historico`
(hoje placeholder) — ver `docs/SPEC.md`.
