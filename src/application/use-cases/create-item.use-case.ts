import { Inject, Injectable } from "@nestjs/common";
import { ItemEntity } from "@domain/entities/item.entity";
import {
  IItemRepository,
  ITEM_REPOSITORY,
} from "@domain/repositories/item.repository";
import { ID_GENERATOR, type IdGenerator } from "@application/ports/id-generator.port";

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

@Injectable()
export class CreateItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: IItemRepository,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  // SKU duplicado nao e pre-checado aqui: a constraint unica do banco e a
  // unica fonte de verdade (sem janela de corrida) e o repositorio traduz a
  // violacao para ItemAlreadyExistsError.
  async execute(
    input: CreateItemInput,
    context: CreateItemContext,
  ): Promise<ItemEntity> {
    const item = ItemEntity.create({
      id: this.idGenerator.generate(),
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
