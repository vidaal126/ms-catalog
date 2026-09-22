import { Module } from "@nestjs/common";
import type { Kafka } from "kafkajs";
import { KafkaClientFactory } from "./kafka-client.factory";
import { KafkaHealthIndicator } from "./kafka.health";
import { KafkaProducerService } from "./kafka-producer.service";
import { KAFKA_CLIENT } from "./kafka.tokens";

// Modulo autocontido (config Kafka, client, producer, base de consumer,
// envelope e health). Depende apenas de @common e das variaveis
// KAFKA_BROKER, KAFKA_CLIENT_ID e HEALTH_CHECK_TIMEOUT_MS do servico.
@Module({
  providers: [
    KafkaClientFactory,
    {
      provide: KAFKA_CLIENT,
      useFactory: (factory: KafkaClientFactory): Kafka => factory.create(),
      inject: [KafkaClientFactory],
    },
    KafkaProducerService,
    KafkaHealthIndicator,
  ],
  exports: [KAFKA_CLIENT, KafkaProducerService, KafkaHealthIndicator],
})
export class MessagingModule {}
