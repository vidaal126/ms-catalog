import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type Item as ItemModel,
} from "@infrastructure/database/generated";
import { ItemEntity } from "@domain/entities/item.entity";
import { ItemAlreadyExistsError } from "@domain/errors/item.errors";
import {
  IItemRepository,
  PaginationParams,
  PersistenceContext,
  resolvePageSize,
} from "@domain/repositories/item.repository";
import { toOutboxEventData } from "@infrastructure/database/mappers/outbox-event.mapper";
import { PrismaService } from "@infrastructure/database/prisma/prisma.service";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

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

  async create(item: ItemEntity, context: PersistenceContext): Promise<void> {
    const events = item.pullDomainEvents();

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.item.create({
          data: {
            id: item.id,
            sku: item.sku,
            name: item.name,
            description: item.description ?? null,
            unitPrice: item.unitPrice,
            weightKg: item.weightKg,
            lengthCm: item.dimensions.lengthCm,
            widthCm: item.dimensions.widthCm,
            heightCm: item.dimensions.heightCm,
            createdAt: item.createdAt,
          },
        });

        if (events.length > 0) {
          await tx.outboxEvent.createMany({
            data: events.map((event) => toOutboxEventData(event, context)),
          });
        }
      });
    } catch (err) {
      // A unica constraint unica alcancavel aqui e items.sku: id do item e do
      // evento sao UUIDs v4 gerados na aplicacao.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ItemAlreadyExistsError(item.sku);
      }
      throw err;
    }
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
