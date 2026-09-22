import type { ConfigService } from "@nestjs/config";
import type { ILogger } from "@common/logger/logger.interface";
import type { Env } from "@config/env";
import type { OutboxEvent } from "@infrastructure/database/generated";
import type { OutboundMessage } from "@infrastructure/messaging/event-envelope";
import type { KafkaProducerService } from "@infrastructure/messaging/kafka-producer.service";
import { OutboxPublisherService } from "./outbox-publisher.service";
import type { OutboxRepository } from "./outbox.repository";

function outboxEvent(id: string): OutboxEvent {
  return {
    id,
    aggregateId: `agg-${id}`,
    eventType: "ItemCreated",
    schemaVersion: 2,
    correlationId: "corr",
    payload: {},
    createdAt: new Date("2026-09-22T12:00:00.000Z"),
    publishedAt: null,
  };
}

const silentLogger: ILogger = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

describe("OutboxPublisherService shutdown", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("termina o envio em andamento, marca como publicado e nao envia o resto do lote", async () => {
    const pending = [outboxEvent("1"), outboxEvent("2"), outboxEvent("3")];
    const markedPublished: string[][] = [];
    const sent: string[] = [];

    let releaseFirstSend: () => void = () => undefined;
    let firstSendStarted: () => void = () => undefined;
    const firstSendStartedPromise = new Promise<void>((resolve) => {
      firstSendStarted = resolve;
    });

    const outbox: Pick<OutboxRepository, "findPending" | "markPublished"> = {
      findPending: async (): Promise<OutboxEvent[]> => pending,
      markPublished: async (ids: readonly string[]): Promise<void> => {
        markedPublished.push([...ids]);
      },
    };
    const producer: Pick<KafkaProducerService, "send"> = {
      send: async (message: OutboundMessage): Promise<void> => {
        if (sent.length === 0) {
          firstSendStarted();
          await new Promise<void>((resolve) => {
            releaseFirstSend = resolve;
          });
        }
        sent.push(message.key);
      },
    };
    const values: Partial<Env> = { OUTBOX_POLL_INTERVAL_MS: 10, OUTBOX_BATCH_SIZE: 20 };
    const config: Pick<ConfigService<Env, true>, "get"> = {
      get: ((key: keyof Env) => values[key]) as ConfigService<Env, true>["get"],
    };

    const publisher = new OutboxPublisherService(
      outbox as OutboxRepository,
      producer as KafkaProducerService,
      silentLogger,
      config as ConfigService<Env, true>,
    );

    publisher.onModuleInit();
    jest.advanceTimersByTime(10);
    jest.useRealTimers();
    await firstSendStartedPromise;

    const destroyed = publisher.onModuleDestroy();
    releaseFirstSend();
    await destroyed;

    expect(sent).toEqual(["agg-1"]);
    expect(markedPublished).toEqual([["1"]]);
  });
});
