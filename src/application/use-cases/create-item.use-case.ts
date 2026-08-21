import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { ItemEntity } from "../../domain/entities/item.entity";
import {
  IItemRepository,
  ITEM_REPOSITORY,
} from "../../domain/repositories/item.repository";

export interface CreateItemInput {
  sku: string;
  name: string;
  description?: string;
  unitPrice: number;
}

@Injectable()
export class CreateItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: IItemRepository,
  ) {}

  async execute(input: CreateItemInput): Promise<ItemEntity> {
    const existing = await this.itemRepository.findBySku(input.sku);
    if (existing) {
      throw new ConflictException(`Item com SKU ${input.sku} já existe`);
    }

    const item = ItemEntity.create({
      sku: input.sku,
      name: input.name,
      description: input.description,
      unitPrice: input.unitPrice,
      createdAt: new Date(),
    });

    return this.itemRepository.create(item);
  }
}
