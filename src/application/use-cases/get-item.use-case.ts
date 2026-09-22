import { Inject, Injectable } from "@nestjs/common";
import { ItemEntity } from "@domain/entities/item.entity";
import { ItemNotFoundError } from "@domain/errors/item.errors";
import {
  IItemRepository,
  ITEM_REPOSITORY,
} from "@domain/repositories/item.repository";

@Injectable()
export class GetItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: IItemRepository,
  ) {}

  async execute(id: string): Promise<ItemEntity> {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new ItemNotFoundError(id);
    }
    return item;
  }
}
