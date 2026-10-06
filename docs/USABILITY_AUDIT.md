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
