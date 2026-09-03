import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { ItemEntity } from "../../domain/entities/item.entity";
import {
  IItemRepository,
  ITEM_REPOSITORY,
} from "../../domain/repositories/item.repository";

export interface CreateItemDimensionsInput {
  readonly lengthCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
}

export interface CreateItemInput {
  readonly sku: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly unitPrice: number;
  readonly weightKg: number;
  readonly dimensions: CreateItemDimensionsInput;
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
      weightKg: input.weightKg,
      dimensions: input.dimensions,
      createdAt: new Date(),
    });

    return this.itemRepository.create(item);
  }
}
