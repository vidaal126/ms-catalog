import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Partitioners, type Producer } from "kafkajs";
import { type ILogger, LOGGER_TOKEN } from "@common/logger/logger.interface";

const CONNECTION_TIMEOUT_MS = 3_000;
const REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private isConnected = false;
  private connecting: Promise<void> | null = null;

  constructor(
    config: ConfigService,
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
  ) {
    this.kafka = new Kafka({
      clientId: "ms-catalog",
      brokers: [config.get<string>("KAFKA_BROKER", "localhost:9092")],
      // Timeout explícito por tentativa: sem ele o socket fica pendurado
      // esperando a rede responder eventualmente.
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      requestTimeout: REQUEST_TIMEOUT_MS,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      idempotent: true,
      // O producer idempotente exige retries ilimitados - qualquer teto invalida
      // a garantia de não-duplicação do broker, e o kafkajs avisa disso se ele
      // herdar o retries: 8 do client acima.
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

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async sendMessage(
    topic: string,
    key: string,
    value: Record<string, unknown>,
  ): Promise<void> {
    await this.connect();

    this.logger.log(`Sending message to topic ${topic} with key ${key}`);
    await this.producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(value),
        },
      ],
    });
    this.logger.log(`Message sent to topic ${topic} with key ${key}`);
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
      .catch((err: Error): never => {
        this.logger.error("Falha ao conectar o Kafka producer", err, {
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
