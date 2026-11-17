// Prepara e sobe o ambiente do aceite ponta a ponta (task #373).
//
// O script é "fino": só orquestra os comandos que já existem no projeto —
// `npm run db:deploy`, `npm run db:seed`, `npm run build` e `npm run start` —
// contra o PostgreSQL de aceite (`TEST_DATABASE_URL` com fallback para
// `DATABASE_URL`). Nada aqui vira mock de banco e nenhum valor sensível é
// impresso (a URL aparece mascarada; FINFAM_* só como definida/ausente).
//
// Uso:
//   npx tsx scripts/acceptance-env.ts prepare          # migrations + seed
//   npx tsx scripts/acceptance-env.ts serve --no-build # sobe e valida /login
//   npx tsx scripts/acceptance-env.ts all              # prepare + build + serve
//
// Opções do `serve`:
//   --no-build    reaproveita o .next existente (falha se não houver build)
//   --port N      usa uma porta específica (default: uma porta livre)
//   --check-only  valida /login e o redirect e encerra o servidor
//
// O servidor fica em primeiro plano até Ctrl+C/SIGTERM; a linha
// `App pronto para o roteiro: http://127.0.0.1:<porta>` permite ao roteiro
// seguinte descobrir a URL.

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acceptanceAuthEnvPresence,
  formatAcceptanceAuthEnv,
  maskDatabaseUrl,
  resolveAcceptanceDatabaseUrl,
  type DatabaseUrlResolution,
} from "../src/lib/acceptance-env";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOGIN_PATH = "/login";
const PROTECTED_PATH = "/gastos";
const READY_TIMEOUT_MS = 60_000;

type Mode = "prepare" | "serve" | "all";

const MODES: readonly Mode[] = ["prepare", "serve", "all"];

function loadDotEnv(): void {
  const envPath = path.join(rootDir, ".env");
  if (!existsSync(envPath)) return;
  if (typeof process.loadEnvFile !== "function") return;
  process.loadEnvFile(envPath);
}

/** Ambiente dos comandos Prisma/Next: o banco de aceite vence as demais URLs. */
function databaseEnv(databaseUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    TEST_DATABASE_URL: databaseUrl,
  };
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} terminou com ${
            signal ? `sinal ${signal}` : `código ${code}`
          }.`,
        ),
      );
    });
  });
}

async function prepare(databaseUrl: string): Promise<void> {
  const env = databaseEnv(databaseUrl);

  console.log("Aplicando migrations (npm run db:deploy)...");
  await runCommand("npm", ["run", "db:deploy"], env);

  console.log("Populando dados de exemplo (npm run db:seed)...");
  await runCommand("npm", ["run", "db:seed"], env);

  console.log("Ambiente pronto: migrations aplicadas e seed concluído.");
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        server.close(() =>
          reject(new Error("Não foi possível escolher uma porta livre.")),
        );
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

function readPort(args: string[]): number | undefined {
  const index = args.indexOf("--port");
  if (index === -1) return undefined;
  const port = Number(args[index + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("--port exige um número inteiro entre 1 e 65535.");
  }
  return port;
}

async function waitForServer(baseUrl: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `O servidor encerrou antes de responder (código ${
          child.exitCode ?? child.signalCode
        }).`,
      );
    }
    try {
      const response = await fetch(new URL(LOGIN_PATH, baseUrl), {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status) return;
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`O servidor não respondeu em ${READY_TIMEOUT_MS / 1000}s.`);
}

async function validateApp(baseUrl: string): Promise<void> {
  const login = await fetch(new URL(LOGIN_PATH, baseUrl), {
    redirect: "manual",
  });
  const loginBody = await login.text();
  if (login.status !== 200) {
    throw new Error(`GET ${LOGIN_PATH} respondeu ${login.status}, esperado 200.`);
  }
  if (!loginBody.includes("FinFam")) {
    throw new Error(`GET ${LOGIN_PATH} não renderizou a tela de login.`);
  }

  const protectedResponse = await fetch(new URL(PROTECTED_PATH, baseUrl), {
    redirect: "manual",
  });
  const location = protectedResponse.headers.get("location");
  const redirectedTo = location
    ? new URL(location, baseUrl).pathname
    : "<sem Location>";
  const redirectExpected =
    (protectedResponse.status === 302 || protectedResponse.status === 307) &&
    redirectedTo === LOGIN_PATH;
  if (!redirectExpected) {
    throw new Error(
      `GET ${PROTECTED_PATH} sem sessão respondeu ${protectedResponse.status} ${redirectedTo}, esperado 302/307 para ${LOGIN_PATH}.`,
    );
  }

  console.log(`PASS GET ${LOGIN_PATH} -> 200`);
  console.log(
    `PASS GET ${PROTECTED_PATH} (sem sessão) -> ${protectedResponse.status} ${redirectedTo}`,
  );
}

function killServer(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid || child.exitCode !== null) return;
  try {
    // `detached: true` coloca o npm/next num grupo próprio; assim o sinal
    // atinge também o `next-server` filho do npm.
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

async function serve(
  database: DatabaseUrlResolution,
  args: string[],
): Promise<void> {
  const noBuild = args.includes("--no-build");
  const checkOnly = args.includes("--check-only");
  const port = readPort(args) ?? (await findFreePort());

  const presence = acceptanceAuthEnvPresence(process.env);
  console.log(`Autenticação: ${formatAcceptanceAuthEnv(presence)}`);
  if (presence.some((item) => !item.present)) {
    console.warn(
      "Atenção: variáveis de autenticação ausentes — o roteiro de login não funcionará até defini-las.",
    );
  }

  const env = databaseEnv(database.url);

  if (noBuild) {
    if (!existsSync(path.join(rootDir, ".next", "BUILD_ID"))) {
      throw new Error(
        "--no-build exige um build existente em .next. Rode npm run build antes.",
      );
    }
    console.log("Reaproveitando o build existente (.next).");
  } else {
    console.log("Gerando build de produção (npm run build)...");
    await runCommand("npm", ["run", "build"], env);
  }

  const child = spawn("npm", ["run", "start"], {
    cwd: rootDir,
    env: { ...env, PORT: String(port), HOSTNAME: "127.0.0.1" },
    stdio: "inherit",
    detached: true,
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  let stopping = false;
  const stop = (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(`\nEncerrando servidor (${signal})...`);
    killServer(child, signal);
    const force = setTimeout(() => killServer(child, "SIGKILL"), 5_000);
    force.unref();
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  try {
    await waitForServer(baseUrl, child);
    await validateApp(baseUrl);
    console.log(`App pronto para o roteiro: ${baseUrl}`);
  } catch (error) {
    stop("SIGTERM");
    throw error;
  }

  if (checkOnly) {
    stop("SIGTERM");
  } else {
    console.log("Pressione Ctrl+C para encerrar.");
  }

  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => {
      console.log("Servidor encerrado.");
      resolve();
    });
  });
}

async function main(): Promise<void> {
  loadDotEnv();

  const args = process.argv.slice(2);
  const modeArg = args.find((arg) => MODES.includes(arg as Mode));
  const mode: Mode = (modeArg as Mode | undefined) ?? "all";

  const database = resolveAcceptanceDatabaseUrl(process.env);
  console.log(
    `Banco de aceite (${database.source}): ${maskDatabaseUrl(database.url)}`,
  );

  if (mode === "prepare" || mode === "all") {
    await prepare(database.url);
  }
  if (mode === "serve" || mode === "all") {
    await serve(database, args);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Erro: ${message}`);
  process.exit(1);
});
