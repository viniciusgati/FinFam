# FinFam — Arquitetura técnica

## Visão de camadas

```
┌─────────────────────────────────────────────────────────┐
│  Navegador (tablet/celular/desktop) — PWA                │
│  React 19 · App Router · Tailwind · manifest + SW        │
└───────────────┬─────────────────────────────────────────┘
                │ fetch / cookies httpOnly
┌───────────────▼─────────────────────────────────────────┐
│  Next.js 15 (server)                                     │
│  ├─ middleware.ts      → protege rotas                    │
│  ├─ app/api/**         → rotas HTTP (auth, finance)       │
│  ├─ lib/session.ts     → assinatura/validação do cookie   │
│  ├─ lib/auth.ts        → valida credenciais (env)         │
│  ├─ lib/finance.ts     → lógica pura do dashboard         │
│  └─ lib/db.ts          → PrismaClient (singleton)         │
└───────────────┬─────────────────────────────────────────┘
                │ Prisma
┌───────────────▼─────────────────────────────────────────┐
│  PostgreSQL                                              │
└─────────────────────────────────────────────────────────┘
```

## Decisões

| Decisão | Motivo |
| --- | --- |
| Next.js fullstack (front + API no mesmo app) | Um único deploy, rotas de API prontas, bom suporte a PWA. |
| TypeScript | Segurança de tipos no domínio financeiro. |
| Prisma + PostgreSQL | Migrations versionadas, tipos gerados, banco definido no `AGENTS.md`. |
| Valores em centavos (`Int`) | Evita imprecisão de float. |
| Lógica financeira pura em `lib/finance.ts` | Testável sem banco/rede (Vitest). |
| Cookie de sessão assinado com `jose` | Simples, stateless, funciona no edge (middleware). |
| Autenticação por env (`FINFAM_USER`/`FINFAM_PASS`) | Requisito explícito; um único login familiar. |
| PWA manual (manifest + SW) | Evita dependência extra e incompatibilidades de versão. |

## Estrutura de pastas

```
.
├── docs/                       # especificação e arquitetura
├── prisma/
│   ├── schema.prisma           # modelo de dados
│   └── seed.ts                 # dados de exemplo
├── public/
│   ├── manifest.webmanifest    # PWA
│   ├── sw.js                   # service worker
│   └── icons/                  # ícones
├── src/
│   ├── app/
│   │   ├── layout.tsx          # shell HTML
│   │   ├── globals.css         # Tailwind
│   │   ├── page.tsx            # dashboard (protegido)
│   │   ├── login/page.tsx      # tela de login
│   │   └── api/
│   │       ├── auth/login/route.ts
│   │       └── auth/logout/route.ts
│   ├── components/             # componentes de UI
│   ├── lib/
│   │   ├── auth.ts             # credenciais + sessão (server)
│   │   ├── session.ts          # jose (edge-safe)
│   │   ├── db.ts               # PrismaClient
│   │   └── finance.ts          # cálculo do dashboard
│   └── middleware.ts           # proteção de rotas
├── .env.example
├── next.config.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Fluxo de autenticação

1. `POST /api/auth/login` recebe `{ user, pass }`.
2. `lib/auth.ts` compara com `FINFAM_USER`/`FINFAM_PASS` usando comparação de
   tempo constante (`crypto.timingSafeEqual`).
3. Em caso de sucesso, assina um JWT (HS256, `FINFAM_SESSION_SECRET`) e grava no
   cookie `finfam_session` (`httpOnly`, `sameSite=lax`, `secure` em produção).
4. `middleware.ts` valida o cookie em rotas protegidas e redireciona para
   `/login` quando inválido.

## Lógica do dashboard

Implementada em `src/lib/finance.ts` como funções puras:

- `computeFinanceStatus(input)` → percentual consumido, ritmo, dias restantes,
  nível e cor.
- `heatColor(ratio)` → cor HSL interpolada verde→vermelho.
- `hasComparisonData(month)` → mês válido para comparação (entrada **e**
  saída); `MIN_COMPARISON_MONTHS = 2` é o mínimo de meses válidos.
- `compareWithHistory(current, previous[])` → mensagem comparativa; sem
  histórico suficiente (menos de 2 meses válidos): "Ainda não há histórico
  suficiente.". A filtragem de meses inválidos é de quem monta a lista
  (`comparableMonths`, `src/lib/family-insights.ts`).

Entrada resumida (`FinanceInput`): renda, saídas fixas, gastos avulsos, faturas
e data de referência. O percentual nunca é persistido; é sempre calculado.

## Banco de dados

- Migrations versionadas com Prisma (`prisma/migrations`).
- Scripts: `npm run db:migrate` (dev), `npm run db:deploy` (prod),
  `npm run db:seed`.
- `DATABASE_URL` obrigatória no `.env`.

## Testes

- **Vitest** para a lógica pura (`src/lib/finance.test.ts`).
- Testes de integração (API + banco) ficam para fases seguintes; usar um banco
  PostgreSQL de teste via `DATABASE_URL`, nunca SQLite para dados reais.

## Build e execução

```bash
npm install
npm run typecheck
npm test
npm run build
npm run start
```
