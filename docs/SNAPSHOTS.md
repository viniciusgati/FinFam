# Ciclo de vida dos snapshots mensais

> Registro das decisões fechadas para o histórico do FinFam: um mês fechado
> vira um snapshot **imutável**, capturado **sem cron**, e o dashboard de mês
> fechado lê sempre o snapshot. Documento de referência; a regra de negócio está
> em `docs/SPEC.md` §4.6.

## Decisões

1. **Captura automática sem cron** — a primeira escrita (gancho no client
   Prisma) ou a primeira leitura de `/`/`/historico` no mês seguinte captura os
   meses fechados ausentes. Sem serviço de agendamento no Railway.
2. **Imutabilidade** — snapshot existente nunca é sobrescrito automaticamente.
   Correção é ação explícita: `db:snapshots --force [--month AAAA-MM]`.
3. **Dashboard de mês fechado lê o snapshot** — agregados, série diária do
   gráfico, consumo disponível e categorias vêm do snapshot; o mês corrente
   continua ao vivo.
4. **Retenção ≥ 5 anos** — sem expurgo; o backfill manual cobre 60 meses e a
   janela automática, 12.
5. **Meses vazios não geram snapshot** — se receberem lançamento retroativo, a
   captura seguinte os pega.

## Fluxo

```
transações (vivas)
   │  buildSnapshot (puro: vigência + competência + série diária)
   ▼
monthly_snapshots + monthly_category_snapshots   ← imutáveis após criados
   │  buildDashboardDataFromSnapshot (puro)
   ▼
dashboard de mês fechado / histórico / comparação "últimos N meses"
```

A base de comparação ("últimos N meses", médias e alertas) segue a regra da
SPEC §4.3: só entram meses **válidos** (≥ 1 entrada e ≥ 1 saída) e são
necessários ao menos **2** meses válidos antes de qualquer comparação —
`hasComparisonData` filtra em `loadDashboardData` e `comparableMonths` filtra
de novo no motor de insights.

## Componentes

| Arquivo | Papel |
| --- | --- |
| `src/lib/snapshots.ts` | derivação pura (`buildSnapshot`, `monthRange`, `missingMonthKeys`, `hasSnapshotData`) |
| `src/lib/snapshot-capture.ts` | `ensureClosedMonthSnapshots` (cria ausentes; `force` recalcula) + predicado do gancho |
| `src/lib/snapshot-month.ts` | `isCompleteSnapshot` + `buildDashboardDataFromSnapshot` (puros) |
| `src/lib/db.ts` | extensão Prisma que dispara a captura após mutações; `captureClosedMonths()` (rede de leitura, memoizada por mês) |
| `src/lib/dashboard.ts` | mês fechado lê snapshot; sem snapshot completo, captura e relê; senão, ao vivo (legado) |
| `src/lib/history-data.ts` | rede de leitura do `/historico` |
| `prisma/snapshots.ts` | CLI `db:snapshots` (backfill/correção) |

## Comandos

```bash
npm run db:snapshots                               # cria ausentes (60 meses)
npm run db:snapshots -- --months 12                # backfill de 12 meses
npm run db:snapshots -- --force                    # recalcula os últimos 4 meses
npm run db:snapshots -- --force --month 2026-09    # corrige um mês específico
```

## Rollout (após o deploy desta mudança)

1. `npx prisma migrate deploy` (a nova migration adiciona série diária e split
   de renda ao snapshot).
2. Opcional, uma vez: `npm run db:snapshots -- --force --months 4` para
   enriquecer os meses fechados existentes (capturas antigas seguem no cálculo
   ao vivo até isso).
3. Nada mais: a captura dos próximos meses é automática.

## Garantias cobertas por teste

- Gancho de escrita real cria o snapshot do mês fechado (`db.integration.test.ts`).
- Captura idempotente, não sobrescreve e respeita o fuso BRT
  (`snapshot-capture.integration.test.ts`).
- Regressão: desativar saída/renda **não** altera o dashboard de mês fechado.
- Paridade snapshot × dashboard ao vivo (`snapshots.integration.test.ts`).
