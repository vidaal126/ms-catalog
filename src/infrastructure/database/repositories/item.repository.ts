import { Injectable } from "@nestjs/common";
import { ItemEntity } from "@domain/entities/item.entity";
import {
  IItemRepository,
  PaginationParams,
  resolvePageSize,
} from "@domain/repositories/item.repository";
import { PrismaService } from "@infrastructure/database/prisma/prisma.service";

@Injectable()
export class ItemRepositoryPrisma implements IItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ItemEntity | undefined> {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) return undefined;
    return this.toDomain(item);
  }

  async findBySku(sku: string): Promise<ItemEntity | undefined> {
    const item = await this.prisma.item.findUnique({ where: { sku } });
    if (!item) return undefined;
    return this.toDomain(item);
  }

  async findByIds(ids: string[]): Promise<ItemEntity[]> {
    const items = await this.prisma.item.findMany({
      where: { id: { in: ids } },
    });
    return items.map((i) => this.toDomain(i));
  }

  async findAll(params?: PaginationParams): Promise<ItemEntity[]> {
    const limit = resolvePageSize(params?.limit);
    const page = params?.page ?? 1;
    const items = await this.prisma.item.findMany({
      take: limit,
      skip: (page - 1) * limit,
    });
    return items.map((i) => this.toDomain(i));
  }

  async create(item: ItemEntity): Promise<ItemEntity> {
    const created = await this.prisma.$transaction(async (tx) => {
      const savedItem = await tx.item.create({
        data: {
          sku: item.sku,
          name: item.name,
          description: item.description,
          unitPrice: item.unitPrice,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateId: savedItem.id,
          eventType: "ItemCreated",
          payload: {
            id: savedItem.id,
            sku: savedItem.sku,
            name: savedItem.name,
            unitPrice: savedItem.unitPrice.toString(),
          },
        },
      });

      return savedItem;
    });

    return this.toDomain(created);
  }
  private toDomain(raw: {
    id: string;
    sku: string;
    name: string;
    description?: string | null;
    unitPrice: unknown;
    createdAt: Date;
  }): ItemEntity {
    return ItemEntity.create({
      id: raw.id,
      sku: raw.sku,
      name: raw.name,
      ...(raw.description ? { description: raw.description } : {}),
      unitPrice: Number(raw.unitPrice),
      createdAt: raw.createdAt,
    });
  }
}
