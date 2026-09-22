import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type Item as ItemModel,
} from "@infrastructure/database/generated";
import { ItemEntity } from "@domain/entities/item.entity";
import { ItemAlreadyExistsError } from "@domain/errors/item.errors";
import {
  IItemRepository,
  Page,
  PageRequest,
  PersistenceContext,
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

  async findAll(request: PageRequest): Promise<Page<ItemEntity>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.item.findMany({
        take: request.pageSize,
        skip: (request.page - 1) * request.pageSize,
        // id como desempate: createdAt pode colidir e, sem ordem total, a
        // paginacao repete ou pula itens entre paginas.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      this.prisma.item.count(),
    ]);
    return { items: items.map((i) => this.toDomain(i)), total };
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
