import { ItemEntity } from "@domain/entities/item.entity";

export const ITEM_REPOSITORY = Symbol("ITEM_REPOSITORY");

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function resolvePageSize(limit?: number): number {
  if (!limit || limit <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

export interface IItemRepository {
  findById(id: string): Promise<ItemEntity | undefined>;
  findBySku(sku: string): Promise<ItemEntity | undefined>;
  findByIds(ids: string[]): Promise<ItemEntity[]>;
  findAll(params?: PaginationParams): Promise<ItemEntity[]>;
  create(item: ItemEntity): Promise<ItemEntity>;
}
