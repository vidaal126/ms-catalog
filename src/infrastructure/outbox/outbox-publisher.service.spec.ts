import type { ConfigService } from "@nestjs/config";
import type { ILogger } from "@common/logger/logger.interface";
import type { Env } from "@config/env";
import type { OutboxEvent } from "@infrastructure/database/generated";
import type {
  EventEnvelope,
  OutboundMessage,
} from "@infrastructure/messaging/event-envelope";
import type { KafkaProducerService } from "@infrastructure/messaging/kafka-producer.service";
import { OutboxPublisherService } from "./outbox-publisher.service";
import type { OutboxRepository } from "./outbox.repository";
import { MetricsService } from "@infrastructure/metrics/metrics.service";

function outboxEvent(id: string, aggregateId = `agg-${id}`): OutboxEvent {
  return {
    id,
    sequence: BigInt(id),
    aggregateId,
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

function buildPublisher(
  outbox: Pick<OutboxRepository, "findPending" | "markPublished">,
  producer: Pick<KafkaProducerService, "send">,
): OutboxPublisherService {
  const values: Partial<Env> = { OUTBOX_POLL_INTERVAL_MS: 10, OUTBOX_BATCH_SIZE: 20 };
  const config: Pick<ConfigService<Env, true>, "get"> = {
    get: ((key: keyof Env) => values[key]),
  };
  return new OutboxPublisherService(
    outbox as OutboxRepository,
    producer as KafkaProducerService,
    silentLogger,
    new MetricsService(),
    config as ConfigService<Env, true>,
  );
}

describe("OutboxPublisherService ordem por agregado", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("falha no agregado A pula os eventos seguintes de A mas publica B", async () => {
    const pending = [
      outboxEvent("1", "A"),
      outboxEvent("2", "B"),
      outboxEvent("3", "A"),
      outboxEvent("4", "B"),
    ];
    const markedPublished: string[][] = [];
    const attempted: string[] = [];

    const outbox: Pick<OutboxRepository, "findPending" | "markPublished"> = {
      findPending: async (): Promise<OutboxEvent[]> => pending,
      markPublished: async (ids: readonly string[]): Promise<void> => {
        markedPublished.push([...ids]);
      },
    };
    const producer: Pick<KafkaProducerService, "send"> = {
      send: async (message: OutboundMessage): Promise<void> => {
        const { eventId } = JSON.parse(String(message.value)) as EventEnvelope;
        attempted.push(eventId);
        if (eventId === "1") throw new Error("broker indisponivel");
      },
    };

    const publisher = buildPublisher(outbox, producer);
    publisher.onModuleInit();
    await jest.advanceTimersByTimeAsync(10);
    await publisher.onModuleDestroy();

    // O evento 3 (A) nem e tentado: fica pendente para o proximo tick.
    expect(attempted).toEqual(["1", "2", "4"]);
    expect(markedPublished).toEqual([["2", "4"]]);
  });
});

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
        sent.push(String(message.key));
      },
    };
    const publisher = buildPublisher(outbox, producer);

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
