import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type Item as ItemModel,
} from "@infrastructure/database/generated";
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
      orderBy: { createdAt: "desc" },
    });
    return items.map((i) => this.toDomain(i));
  }

  async create(item: ItemEntity): Promise<ItemEntity> {
    const created = await this.prisma.$transaction(async (tx) => {
      const savedItem = await tx.item.create({
        data: {
          sku: item.sku,
          name: item.name,
          description: item.description ?? null,
          unitPrice: item.unitPrice,
          weightKg: item.weightKg,
          lengthCm: item.dimensions.lengthCm,
          widthCm: item.dimensions.widthCm,
          heightCm: item.dimensions.heightCm,
        },
      });

      const payload: Prisma.InputJsonObject = {
        schemaVersion: 1,
        id: savedItem.id,
        sku: savedItem.sku,
        name: savedItem.name,
        unitPrice: savedItem.unitPrice.toNumber(),
        weightKg: savedItem.weightKg.toNumber(),
        dimensions: {
          lengthCm: savedItem.lengthCm.toNumber(),
          widthCm: savedItem.widthCm.toNumber(),
          heightCm: savedItem.heightCm.toNumber(),
        },
      };

      await tx.outboxEvent.create({
        data: {
          aggregateId: savedItem.id,
          eventType: "ItemCreated",
          payload,
        },
      });

      return savedItem;
    });

    return this.toDomain(created);
  }

  private toDomain(raw: ItemModel): ItemEntity {
    return ItemEntity.restore({
      id: raw.id,
      sku: raw.sku,
      name: raw.name,
      description: raw.description ?? undefined,
      unitPrice: raw.unitPrice.toNumber(),
      weightKg: raw.weightKg.toNumber(),
      dimensions: {
        lengthCm: raw.lengthCm.toNumber(),
        widthCm: raw.widthCm.toNumber(),
        heightCm: raw.heightCm.toNumber(),
      },
      createdAt: raw.createdAt,
    });
  }
}
