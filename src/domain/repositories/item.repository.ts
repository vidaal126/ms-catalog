import { ItemEntity } from "@domain/entities/item.entity";

export const ITEM_REPOSITORY = Symbol("ITEM_REPOSITORY");

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface Page<T> {
  readonly items: T[];
  readonly total: number;
}

// Metadados de rastreamento que acompanham os eventos do agregado ate o outbox.
export interface PersistenceContext {
  readonly correlationId: string;
}

export interface IItemRepository {
  findById(id: string): Promise<ItemEntity | undefined>;
  findBySku(sku: string): Promise<ItemEntity | undefined>;
  findByIds(ids: string[]): Promise<ItemEntity[]>;
  findAll(request: PageRequest): Promise<Page<ItemEntity>>;
  // Persiste o agregado e converte seus eventos de dominio em registros de
  // outbox na mesma transacao. Lanca ItemAlreadyExistsError em SKU duplicado.
  create(item: ItemEntity, context: PersistenceContext): Promise<void>;
}
