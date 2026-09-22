import { Module } from "@nestjs/common";
import { ID_GENERATOR } from "@application/ports/id-generator.port";
import { CreateItemUseCase } from "@application/use-cases/create-item.use-case";
import { GetItemUseCase } from "@application/use-cases/get-item.use-case";
import { ListItemsUseCase } from "@application/use-cases/list-items.use-case";
import { ITEM_REPOSITORY } from "@domain/repositories/item.repository";
import { ItemRepositoryPrisma } from "@infrastructure/database/repositories/item.repository";
import { ItemController } from "@infrastructure/http/item.controller";
import { IdempotencyModule } from "@infrastructure/idempotency/idempotency.module";
import { UuidIdGenerator } from "@infrastructure/identity/uuid-id-generator";
import { MessagingModule } from "@infrastructure/messaging/messaging.module";
import { OutboxPublisherService } from "@infrastructure/outbox/outbox-publisher.service";
import { OutboxRepository } from "@infrastructure/outbox/outbox.repository";

@Module({
  imports: [MessagingModule, IdempotencyModule],
  controllers: [ItemController],
  providers: [
    { provide: ITEM_REPOSITORY, useClass: ItemRepositoryPrisma },
    { provide: ID_GENERATOR, useClass: UuidIdGenerator },
    CreateItemUseCase,
    GetItemUseCase,
    ListItemsUseCase,
    OutboxRepository,
    OutboxPublisherService,
  ],
  exports: [ITEM_REPOSITORY],
})
export class ItemModule {}
