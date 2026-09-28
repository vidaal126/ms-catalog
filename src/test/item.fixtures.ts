import type {
  CreateItemProps,
  RestoreItemProps,
} from "@domain/entities/item.entity";
import { ItemEntity } from "@domain/entities/item.entity";
import type {
  IItemRepository,
  Page,
  PageRequest,
  PersistenceContext,
} from "@domain/repositories/item.repository";

export function buildCreateItemProps(
  overrides: Partial<CreateItemProps> = {},
): CreateItemProps {
  return {
    sku: "BOX-001",
    name: "Caixa",
    description: "Caixa de papelao",
    unitPrice: 10.5,
    weightKg: 1.25,
    dimensions: { lengthCm: 30, widthCm: 20, heightCm: 10.5 },
    createdAt: new Date("2026-09-22T12:00:00.000Z"),
    ...overrides,
  };
}

export function buildRestoreItemProps(
  overrides: Partial<RestoreItemProps> = {},
): RestoreItemProps {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    ...buildCreateItemProps(),
    ...overrides,
  };
}

export class InMemoryItemRepository implements IItemRepository {
  readonly items: ItemEntity[] = [];
  readonly contexts: PersistenceContext[] = [];
  createError: Error | undefined;

  async findById(id: string): Promise<ItemEntity | undefined> {
    return this.items.find((i) => i.id === id);
  }

  async findBySku(sku: string): Promise<ItemEntity | undefined> {
    return this.items.find((i) => i.sku === sku);
  }

  async findByIds(ids: string[]): Promise<ItemEntity[]> {
    return this.items.filter((i) => ids.includes(i.id));
  }

  async findAll(request: PageRequest): Promise<Page<ItemEntity>> {
    const start = (request.page - 1) * request.pageSize;
    return {
      items: this.items.slice(start, start + request.pageSize),
      total: this.items.length,
    };
  }

  async create(item: ItemEntity, context: PersistenceContext): Promise<void> {
    if (this.createError) throw this.createError;
    this.items.push(item);
    this.contexts.push(context);
  }
}
