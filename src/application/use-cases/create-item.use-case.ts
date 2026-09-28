import { ItemEntity } from "@domain/entities/item.entity";
import type { IItemRepository } from "@domain/repositories/item.repository";

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

export interface CreateItemContext {
  readonly correlationId: string;
}

export class CreateItemUseCase {
  constructor(private readonly itemRepository: IItemRepository) {}

  // SKU duplicado nao e pre-checado aqui: a constraint unica do banco e a
  // unica fonte de verdade (sem janela de corrida) e o repositorio traduz a
  // violacao para ItemAlreadyExistsError.
  async execute(
    input: CreateItemInput,
    context: CreateItemContext,
  ): Promise<ItemEntity> {
    const item = ItemEntity.create({
      sku: input.sku,
      name: input.name,
      description: input.description,
      unitPrice: input.unitPrice,
      weightKg: input.weightKg,
      dimensions: input.dimensions,
      createdAt: new Date(),
    });

    await this.itemRepository.create(item, {
      correlationId: context.correlationId,
    });

    return item;
  }
}
