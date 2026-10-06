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
- **Vitest** para testes unitários da lógica financeira
- Sessão via cookie `httpOnly` assinado com **jose**

Detalhes de arquitetura e regras em [`docs/`](./docs):

- [`docs/SPEC.md`](./docs/SPEC.md) — especificação funcional
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — arquitetura técnica

## Como rodar

Pré-requisitos: Node.js 20+ e um PostgreSQL acessível.

```bash
# 1. instalar dependências
npm install

# 2. configurar variáveis de ambiente
cp .env.example .env
# edite .env com DATABASE_URL e credenciais FINFAM_*

# 3. aplicar migrations e (opcional) popular dados de exemplo
npm run db:migrate
npm run db:seed

# 4. desenvolvimento
npm run dev
# abra http://localhost:3000
```

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run start` | inicia o build de produção |
| `npm run typecheck` | checagem de tipos (`tsc --noEmit`) |
| `npm test` | testes unitários (Vitest) |
| `npm run db:migrate` | cria/aplica migrations em dev |
| `npm run db:deploy` | aplica migrations em produção |
| `npm run db:seed` | popula o banco com dados de exemplo |
| `npm run db:studio` | Prisma Studio |

## Variáveis de ambiente

Veja [`.env.example`](./.env.example). Principais:

- `DATABASE_URL` — conexão PostgreSQL.
- `FINFAM_USER` / `FINFAM_PASS` — credenciais de acesso da família.
- `FINFAM_SESSION_SECRET` — segredo para assinar o cookie de sessão.

## Status

Projeto **iniciado** (Fase 0). Esqueleto de aplicação, modelo de dados,
especificação e infraestrutura de testes prontos. A lógica de negócio completa
do dashboard e as telas de cadastro/lançamento ainda serão implementadas nas
próximas fases — ver `docs/SPEC.md`.
