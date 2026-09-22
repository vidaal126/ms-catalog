import { Module } from "@nestjs/common";
import { ID_GENERATOR } from "@application/ports/id-generator.port";
import { CreateItemUseCase } from "@application/use-cases/create-item.use-case";
import { GetItemUseCase } from "@application/use-cases/get-item.use-case";
import { ListItemsUseCase } from "@application/use-cases/list-items.use-case";
import { ITEM_REPOSITORY } from "@domain/repositories/item.repository";
import { ItemRepositoryPrisma } from "@infrastructure/database/repositories/item.repository";
import { ItemController } from "@infrastructure/http/item.controller";
import { UuidIdGenerator } from "@infrastructure/identity/uuid-id-generator";
import { KafkaProducerService } from "@infrastructure/messaging/kafka-producer.service";
import { OutboxPublisherService } from "@infrastructure/messaging/outbox-publisher.service";

@Module({
  controllers: [ItemController],
  providers: [
    { provide: ITEM_REPOSITORY, useClass: ItemRepositoryPrisma },
    { provide: ID_GENERATOR, useClass: UuidIdGenerator },
    CreateItemUseCase,
    GetItemUseCase,
    ListItemsUseCase,
    KafkaProducerService,
    OutboxPublisherService,
  ],
  exports: [ITEM_REPOSITORY],
})
export class ItemModule {}
