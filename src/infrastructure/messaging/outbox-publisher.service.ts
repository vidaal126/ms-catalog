import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type ILogger, LOGGER_TOKEN } from "@common/logger/logger.interface";
import { PrismaService } from "@infrastructure/database/prisma/prisma.service";
import { KafkaProducerService } from "./kafka-producer.service";

// Este é o componente que fecha o padrão Outbox. Sem ele, gravar o evento
// na tabela outbox_events não serve pra nada - é só um log morto.
//
// O que ele faz, a cada tick:
// 1. Busca até BATCH_SIZE eventos com publishedAt = null (não publicados)
// 2. Envia cada um pro Kafka
// 3. Marca publishedAt = now() SÓ depois de confirmar o envio
//
// Dor proposital: se o processo morrer entre o envio ao Kafka e o UPDATE
// do publishedAt, o evento será reenviado no próximo poll (at-least-once,
// não exactly-once). O idempotent:true do producer protege contra
// duplicação por retry de rede, mas não contra o processo caindo de
// verdade no meio - por isso consumidores desse evento PRECISAM ser
// idempotentes, o mesmo bloqueador de idempotência já mapeado no
// ARCHITECTURE.md original, agora do lado do consumidor de eventos.
@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafkaProducer: KafkaProducerService,
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
    config: ConfigService,
  ) {
    this.pollIntervalMs = config.get<number>("OUTBOX_POLL_INTERVAL_MS", 2000);
    this.batchSize = config.get<number>("OUTBOX_BATCH_SIZE", 20);
  }

  onModuleInit(): void {
    this.intervalHandle = setInterval(() => {
      void this.pollAndPublish();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  private async pollAndPublish(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const pending = await this.prisma.outboxEvent.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: "asc" },
        take: this.batchSize,
      });

      for (const event of pending) {
        try {
          await this.kafkaProducer.sendMessage(
            this.topicFor(event.eventType),
            event.aggregateId,
            {
              eventType: event.eventType,
              aggregateId: event.aggregateId,
              payload: event.payload,
              occurredAt: event.createdAt.toISOString(),
            },
          );

          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { publishedAt: new Date() },
          });

          this.logger.log(
            `Evento publicado: ${event.eventType} (aggregateId=${event.aggregateId})`,
          );
        } catch (err) {
          this.logger.error(
            `Falha ao publicar evento ${event.id}`,
            err as Error,
          );
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  private topicFor(eventType: string): string {
    return `catalog.${eventType}`;
  }
}
