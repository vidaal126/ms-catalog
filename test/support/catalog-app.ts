import { execFileSync } from "node:child_process";
import type { NestExpressApplication } from "@nestjs/platform-express";

export interface RunningCatalogApp {
  readonly app: NestExpressApplication;
  readonly baseUrl: string;
}

export function migrateDatabase(databaseUrl: string): void {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}

// Sobe o ms-catalog em processo com a mesma configuracao HTTP do main.ts.
// O import acontece depois do env: o ConfigModule valida as variaveis ao
// carregar o AppModule.
export async function startCatalogApp(env: Record<string, string>): Promise<RunningCatalogApp> {
  Object.assign(process.env, { NODE_ENV: "production", LOG_LEVEL: "error", ...env });

  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("../../src/app.module");
  const { configureApp } = await import("../../src/app.setup");

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0);
  const baseUrl = (await app.getUrl()).replace("[::1]", "localhost");
  return { app, baseUrl };
}

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const parsed: unknown = await response.json();
  return { status: response.status, headers: response.headers, body: parsed };
}
