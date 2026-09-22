import { Logger } from "nestjs-pino";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { Env } from "@config/env";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // abortOnError: false - erro de inicializacao (ex.: env invalida) sobe para
  // o catch de bootstrap, que imprime a mensagem e sai com codigo 1.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get("PORT", { infer: true }));
}

bootstrap().catch((err: unknown): void => {
  // Env invalida cai aqui antes do logger existir: mensagem direta no stderr.
  process.stderr.write(
    `Falha ao iniciar ms-catalog: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
