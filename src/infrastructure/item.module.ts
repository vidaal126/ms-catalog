import { Module } from "@nestjs/common";
import { ITEM_REPOSITORY } from "@domain/repositories/item.repository";
import { ItemRepositoryPrisma } from "@infrastructure/database/repositories/item.repository";
import { ItemController } from "@infrastructure/http/item.controller";
import { KafkaProducerService } from "@infrastructure/messaging/kafka-producer.service";
import { OutboxPublisherService } from "@infrastructure/messaging/outbox-publisher.service";
import { CreateItemUseCase } from "../application/use-cases/create-item.use-case";

@Module({
  controllers: [ItemController],
  providers: [
    { provide: ITEM_REPOSITORY, useClass: ItemRepositoryPrisma },
    CreateItemUseCase,
    KafkaProducerService,
    OutboxPublisherService,
  ],
  exports: [ITEM_REPOSITORY],
})
export class ItemModule {}
