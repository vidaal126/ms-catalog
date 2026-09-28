import { Module } from "@nestjs/common";
import { CreateItemUseCase } from "@application/use-cases/create-item.use-case";
import { GetItemUseCase } from "@application/use-cases/get-item.use-case";
import { ListItemsUseCase } from "@application/use-cases/list-items.use-case";
import {
  type IItemRepository,
  ITEM_REPOSITORY,
} from "@domain/repositories/item.repository";
import { ItemRepositoryPrisma } from "@infrastructure/database/repositories/item.repository";
import { ItemController } from "@infrastructure/http/item.controller";
import { IdempotencyModule } from "@infrastructure/idempotency/idempotency.module";
import { MessagingModule } from "@infrastructure/messaging/messaging.module";
import { OutboxPublisherService } from "@infrastructure/outbox/outbox-publisher.service";
import { OutboxRepository } from "@infrastructure/outbox/outbox.repository";

@Module({
  imports: [MessagingModule, IdempotencyModule],
  controllers: [ItemController],
  providers: [
    { provide: ITEM_REPOSITORY, useClass: ItemRepositoryPrisma },
    // Use cases nao conhecem Nest: a composicao fica aqui.
    {
      provide: CreateItemUseCase,
      useFactory: (repository: IItemRepository) =>
        new CreateItemUseCase(repository),
      inject: [ITEM_REPOSITORY],
    },
    {
      provide: GetItemUseCase,
      useFactory: (repository: IItemRepository) =>
        new GetItemUseCase(repository),
      inject: [ITEM_REPOSITORY],
    },
    {
      provide: ListItemsUseCase,
      useFactory: (repository: IItemRepository) =>
        new ListItemsUseCase(repository),
      inject: [ITEM_REPOSITORY],
    },
    OutboxRepository,
    OutboxPublisherService,
  ],
  exports: [ITEM_REPOSITORY],
})
export class ItemModule {}
