import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, type Producer } from "kafkajs";
import { type ILogger, LOGGER_TOKEN } from "@common/logger/logger.interface";

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;

  constructor(
    config: ConfigService,
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
  ) {
    this.kafka = new Kafka({
      clientId: "ms-catalog",
      brokers: [config.get<string>("KAFKA_BROKER", "localhost:9092")],
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });
    this.producer = this.kafka.producer({ idempotent: true });
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
    this.logger.log("Kafka producer connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
    this.logger.log("Kafka producer disconnected");
  }

  async sendMessage(
    topic: string,
    key: string,
    value: Record<string, unknown>,
  ): Promise<void> {
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
}
