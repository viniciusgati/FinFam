# FinFam — instruções do projeto

App de finanças da família: Next.js 15 (App Router) + Prisma/PostgreSQL + Vitest.
Regras de negócio em `docs/SPEC.md`; arquitetura em `docs/ARCHITECTURE.md`.

## Verificação obrigatória antes de commitar

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # unitários (NÃO inclui *.integration.test.ts)
npm run build       # next build
```

Integração (exige PostgreSQL de teste com as migrations aplicadas):

```bash
TEST_DATABASE_URL="postgresql://user:pass@host:5432/finfam_test" npm run test:integration
```

Nunca commitar com `npm test` vermelho. Se a tarefa tocar banco/migrations,
rode também a suíte de integração.

## Onde cada teste mora (e o que precisa cobrir)

| Tipo de mudança | Teste | Padrão |
| --- | --- | --- |
| Função pura em `src/lib/*.ts` | `*.test.ts` ao lado | entrada/saída exata, limites e casos de erro |
| Rota de API `src/app/api/**/route.ts` | `route.test.ts` | `vi.mock("@/lib/db")`; 200/201/400/404 e "não persistiu" |
| Componente de apresentação | `*.test.ts` com `renderToStaticMarkup` | textos exatos; o projeto não tem test runner de DOM |
| Regra que depende do banco (agregação, vigência, ciclo, competência de fatura) | `*.integration.test.ts` | `requireTestDatabase()` + `resetDatabase()` no `beforeEach` |
| Página (server component) | não tem teste de DOM | extraia a lógica para `src/lib` e teste a função pura |

## Regras de teste

- Toda função pura nova ou alterada precisa de teste; mudança de comportamento
  **atualiza** o teste existente (não deixe expectativa velha passando por acaso).
- Proibido snapshot testing. Proibido depender de `new Date()`/`Date.now()` reais:
  injete `now`/`referenceDate`/`timeZone`.
- Textos de UI derivados de função pura: teste os textos exatos na função pura
  (ex.: `impactLabel`, `summary`), não no JSX.
- `formatCents` usa espaço não separável: normalize com
  `replace(/\u00a0/g, " ")` antes de comparar strings.
- Bug reportado pelo usuário: adicione um **teste de regressão** que falha sem a
  correção, citando o sintoma no nome do teste.
- Testes de integração importam de `src/test/integration.ts`; tabelas novas entram
  no array `TABLES` (TRUNCATE) e no `resetDatabase` do seed.
- Ao mudar `prisma/schema.prisma`: migration versionada em `prisma/migrations/`,
  `npx prisma generate` e atualização de mocks (`prismaMock`) e fixtures afetadas.
- Mocks de Prisma em teste unitário: declare só os métodos usados
  (`vi.hoisted` + `vi.mock("@/lib/db")`) e configure o default no `beforeEach`.

## Convenções que afetam testes

- Prefira funções puras (sem banco/rede) em `src/lib`; páginas e rotas apenas
  orquestram.
- Dinheiro em centavos inteiros; percentuais podem ser `Float`.
- Datas/"hoje" sempre pelo fuso da família (`resolveTimeZone`, `todayISO`), nunca
  `toISOString().slice(0, 10)`.
- Mensagens e rótulos em pt-BR.

## Referências de testes existentes

- Puro com calendário: `src/lib/cycle.test.ts`, `src/lib/finance.test.ts`.
- Rota com Prisma mockado: `src/app/api/variable-incomes/route.test.ts`.
- Componente renderizado: `src/components/DailyAllowanceCard.test.ts`,
  `src/components/MonthSpendCard.test.ts`.
- Integração com banco: `src/lib/dashboard.integration.test.ts`,
  `src/lib/cycle.integration.test.ts`.
- IA (veredito local + prompt só com números): `src/lib/ai/purchase-simulator.test.ts`.
