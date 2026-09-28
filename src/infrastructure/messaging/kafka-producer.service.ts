import {
  Inject,
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Kafka, Partitioners, type Producer } from "kafkajs";
import { type ILogger, LOGGER_TOKEN } from "@common/logger/logger.interface";
import { withTimeout } from "@common/with-timeout";
import type { OutboundMessage } from "./event-envelope";
import { KAFKA_CLIENT } from "./kafka.tokens";

interface ProducerEnv {
  KAFKA_SEND_TIMEOUT_MS: number;
}

@Injectable()
export class KafkaProducerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly producer: Producer;
  private isConnected = false;
  private connecting: Promise<void> | null = null;
  private readonly sendTimeoutMs: number;

  constructor(
    @Inject(KAFKA_CLIENT) kafka: Kafka,
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
    config: ConfigService<ProducerEnv, true>,
  ) {
    // Sem anotacao: atribuir direto ao campo tipado deixaria o get inferir o
    // retorno pelo contexto, sem checagem.
    const sendTimeoutMs = config.get("KAFKA_SEND_TIMEOUT_MS", { infer: true });
    this.sendTimeoutMs = sendTimeoutMs;
    this.producer = kafka.producer({
      idempotent: true,
      // O producer idempotente exige retries ilimitados - qualquer teto invalida
      // a garantia de não-duplicação do broker, e o kafkajs avisa disso se ele
      // herdar o retries: 8 do client (KafkaClientFactory).
      retry: { retries: Number.MAX_SAFE_INTEGER },
      // Explícito para fixar o particionador da v2 e silenciar o warning de
      // migração do kafkajs. É o mesmo comportamento padrão desde a v2.0.0.
      createPartitioner: Partitioners.DefaultPartitioner,
    });

    this.producer.on(this.producer.events.DISCONNECT, (): void => {
      this.isConnected = false;
      this.logger.warn("Kafka producer desconectado", {
        service: KafkaProducerService.name,
      });
    });
  }

  onModuleInit(): void {
    // Degradação prevista: broker indisponível não pode derrubar a aplicação.
    // A conexão fica tentando em segundo plano (retries ilimitados exigidos pelo
    // producer idempotente), a API continua respondendo e o outbox segue
    // gravando eventos no Postgres. A publicação retoma sozinha quando o broker
    // volta - nenhum evento se perde, só atrasa.
    void this.connect().catch((): void => undefined);
  }

  // onApplicationShutdown roda depois de todos os onModuleDestroy: o outbox
  // publisher ja parou e terminou o ciclo em andamento quando chegamos aqui.
  async onApplicationShutdown(): Promise<void> {
    await this.producer.disconnect();
  }

  // Com retries ilimitados um envio pode nunca terminar (broker fora, lider
  // indisponivel) e travaria o outbox inteiro. O timeout transforma isso em
  // falha comum: o publisher deixa o evento pendente e tenta no proximo tick.
  // O envio original segue vivo no kafkajs; se completar depois, o reenvio
  // gera duplicata, que o consumer deduplica pelo eventId.
  async send(message: OutboundMessage): Promise<void> {
    await withTimeout(
      this.connectAndSend(message),
      this.sendTimeoutMs,
      `Kafka send timeout (topic=${message.topic})`,
    );
  }

  private async connectAndSend(message: OutboundMessage): Promise<void> {
    await this.connect();

    this.logger.log(
      `Sending message to topic ${message.topic} with key ${message.key}`,
    );
    await this.producer.send({
      topic: message.topic,
      messages: [
        {
          key: message.key,
          value: message.value,
          headers: { ...message.headers },
        },
      ],
    });
    this.logger.log(
      `Message sent to topic ${message.topic} with key ${message.key}`,
    );
  }

  private async connect(): Promise<void> {
    if (this.isConnected) return;

    // Uma única tentativa em voo por vez: senão cada evento pendente do outbox
    // dispara o seu próprio connect() em paralelo contra o mesmo broker.
    this.connecting ??= this.producer
      .connect()
      .then((): void => {
        this.isConnected = true;
        this.logger.log("Kafka producer conectado");
      })
      .catch((err: unknown): never => {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.error("Falha ao conectar o Kafka producer", error, {
          service: KafkaProducerService.name,
          method: "connect",
        });
        throw err;
      })
      .finally((): void => {
        this.connecting = null;
      });

    await this.connecting;
  }
}
