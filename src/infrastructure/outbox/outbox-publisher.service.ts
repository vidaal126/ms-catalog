import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type ILogger, LOGGER_TOKEN } from "@common/logger/logger.interface";
import type { Env } from "@config/env";
import { KafkaProducerService } from "@infrastructure/messaging/kafka-producer.service";
import { toOutboundMessage } from "./outbox-message.mapper";
import { OutboxRepository } from "./outbox.repository";

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
// idempotentes (o eventId do envelope é estável entre reenvios).
@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly kafkaProducer: KafkaProducerService,
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
    config: ConfigService<Env, true>,
  ) {
    this.pollIntervalMs = config.get("OUTBOX_POLL_INTERVAL_MS", { infer: true });
    this.batchSize = config.get("OUTBOX_BATCH_SIZE", { infer: true });
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
      const pending = await this.outbox.findPending(this.batchSize);

      const publishedIds: string[] = [];

      for (const event of pending) {
        try {
          await this.kafkaProducer.send(toOutboundMessage(event));

          publishedIds.push(event.id);

          this.logger.log(
            `Evento publicado: ${event.eventType} (aggregateId=${event.aggregateId})`,
            { eventId: event.id, correlationId: event.correlationId },
          );
        } catch (err) {
          this.logger.error(
            `Falha ao publicar evento ${event.id}`,
            err as Error,
          );
        }
      }

      if (publishedIds.length > 0) {
        try {
          await this.outbox.markPublished(publishedIds, new Date());
        } catch (err) {
          this.logger.error(
            `Falha ao marcar ${publishedIds.length} evento(s) como publicado(s)`,
            err as Error,
          );
        }
      }
    } finally {
      this.isPolling = false;
    }
  }
}
