import {
  Inject,
  Injectable,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HealthCheckError,
  HealthIndicator,
  type HealthIndicatorResult,
} from "@nestjs/terminus";
import type { Admin, Kafka } from "kafkajs";
import { type ILogger, LOGGER_TOKEN } from "@common/logger/logger.interface";
import { withTimeout } from "@common/with-timeout";
import { KAFKA_CLIENT } from "./kafka.tokens";

interface HealthEnv {
  HEALTH_CHECK_TIMEOUT_MS: number;
}

// Pergunta ao broker (describeCluster) em vez de olhar o estado do producer:
// o producer so reconecta quando ha algo a enviar, entao seu estado pode
// ficar "desconectado" com o broker ja de pe.
@Injectable()
export class KafkaHealthIndicator
  extends HealthIndicator
  implements OnApplicationShutdown
{
  private admin: Admin | null = null;
  private readonly timeoutMs: number;

  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafka: Kafka,
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
    config: ConfigService<HealthEnv, true>,
  ) {
    super();
    // Sem anotacao: atribuir direto ao campo tipado deixaria o get inferir o
    // retorno pelo contexto, sem checagem.
    const timeoutMs = config.get("HEALTH_CHECK_TIMEOUT_MS", { infer: true });
    this.timeoutMs = timeoutMs;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await withTimeout(this.ping(), this.timeoutMs, "Kafka health check timeout");
      return this.getStatus(key, true);
    } catch (err) {
      // Detalhe so no log: a resposta do probe nao expoe infraestrutura.
      this.logger.warn("Kafka indisponivel no health check", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HealthCheckError(
        "Kafka indisponivel",
        this.getStatus(key, false, { message: "indisponivel" }),
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.admin?.disconnect();
  }

  private async ping(): Promise<void> {
    // retries: 0 - quem repete e o orquestrador chamando o probe de novo.
    this.admin ??= this.kafka.admin({ retry: { retries: 0 } });
    await this.admin.connect();
    await this.admin.describeCluster();
  }
}
