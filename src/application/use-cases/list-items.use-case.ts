import { ItemEntity } from "@domain/entities/item.entity";
import type { IItemRepository } from "@domain/repositories/item.repository";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function resolvePageSize(limit?: number): number {
  if (!limit || limit <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

export interface ListItemsInput {
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
}

export interface ListItemsOutput {
  readonly items: ItemEntity[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export class ListItemsUseCase {
  constructor(private readonly itemRepository: IItemRepository) {}

  async execute(input: ListItemsInput): Promise<ListItemsOutput> {
    const page = input.page && input.page > 0 ? input.page : 1;
    const pageSize = resolvePageSize(input.limit);

    const { items, total } = await this.itemRepository.findAll({
      page,
      pageSize,
    });

    return { items, total, page, pageSize };
  }
}
