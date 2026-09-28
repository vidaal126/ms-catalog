import { ItemEntity } from "@domain/entities/item.entity";
import { ItemNotFoundError } from "@domain/errors/item.errors";
import type { IItemRepository } from "@domain/repositories/item.repository";

export class GetItemUseCase {
  constructor(private readonly itemRepository: IItemRepository) {}

  async execute(id: string): Promise<ItemEntity> {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new ItemNotFoundError(id);
    }
    return item;
  }
}
