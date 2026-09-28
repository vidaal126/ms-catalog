import { Injectable } from "@nestjs/common";
import type { OutboxEvent } from "@infrastructure/database/generated";
import { PrismaService } from "@infrastructure/database/prisma/prisma.service";

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Ordena por sequence (ordem de insercao), nao por createdAt: timestamps
  // podem empatar e embaralhar eventos do mesmo agregado.
  async findPending(limit: number): Promise<OutboxEvent[]> {
    return this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { sequence: "asc" },
      take: limit,
    });
  }

  async countPending(): Promise<number> {
    return this.prisma.outboxEvent.count({ where: { publishedAt: null } });
  }

  async markPublished(ids: readonly string[], publishedAt: Date): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: [...ids] } },
      data: { publishedAt },
    });
  }
}
