import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HealthCheckError,
  HealthIndicator,
  type HealthIndicatorResult,
} from "@nestjs/terminus";
import { type ILogger, LOGGER_TOKEN } from "@common/logger/logger.interface";
import { withTimeout } from "@common/with-timeout";
import { type Env, readEnv } from "@config/env";
import { PrismaService } from "@infrastructure/database/prisma/prisma.service";

// O PrismaHealthIndicator do terminus 10 chama $runCommandRaw (so existe no
// client Mongo) e so cai para SELECT 1 com uma mensagem especifica do Mongo;
// com o client PostgreSQL do Prisma 7 ele reportaria "down" sempre.
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  private readonly timeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
    config: ConfigService<Env, true>,
  ) {
    super();
    this.timeoutMs = readEnv(config, "HEALTH_CHECK_TIMEOUT_MS");
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await withTimeout(
        this.prisma.$queryRaw`SELECT 1`,
        this.timeoutMs,
        "Database health check timeout",
      );
      return this.getStatus(key, true);
    } catch (err) {
      this.logger.warn("Banco indisponivel no health check", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HealthCheckError(
        "Banco indisponivel",
        this.getStatus(key, false, { message: "indisponivel" }),
      );
    }
  }
}
