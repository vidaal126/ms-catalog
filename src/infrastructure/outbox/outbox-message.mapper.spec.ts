import { ItemEntity } from "@domain/entities/item.entity";
import type { OutboxEvent } from "@infrastructure/database/generated";
import {
  ITEM_CREATED_SCHEMA_VERSION,
  toOutboxEventData,
} from "@infrastructure/database/mappers/outbox-event.mapper";
import { buildCreateItemProps } from "../../test/item.fixtures";
import { toOutboundMessage } from "./outbox-message.mapper";

describe("ItemCreated no outbox -> mensagem Kafka", () => {
  const props = buildCreateItemProps();
  const item = ItemEntity.create(props);
  const [event] = item.pullDomainEvents();
  if (!event) throw new Error("ItemCreated nao registrado");

  const data = toOutboxEventData(event, { correlationId: "corr-1" });

  // Simula a linha como o Prisma a devolve depois de gravada.
  const row: OutboxEvent = {
    id: "33333333-3333-4333-8333-333333333333",
    sequence: 1n,
    aggregateId: data.aggregateId,
    eventType: data.eventType,
    schemaVersion: data.schemaVersion,
    correlationId: data.correlationId,
    payload: {
      id: item.id,
      sku: props.sku,
      name: props.name,
      unitPrice: props.unitPrice,
      weightKg: props.weightKg,
      dimensions: { ...props.dimensions },
    },
    createdAt: props.createdAt,
    publishedAt: null,
  };

  it("grava o registro de outbox sem schemaVersion no payload", () => {
    expect(data).toMatchObject({
      aggregateId: item.id,
      eventType: "ItemCreated",
      schemaVersion: ITEM_CREATED_SCHEMA_VERSION,
      correlationId: "corr-1",
      createdAt: props.createdAt,
    });
    expect(data.payload).toEqual(row.payload);
  });

  it("publica envelope v2 com key = aggregateId e headers", () => {
    const message = toOutboundMessage(row);

    expect(message.topic).toBe("catalog.ItemCreated");
    expect(message.key).toBe(item.id);
    expect(message.headers).toEqual({
      eventType: "ItemCreated",
      schemaVersion: "2",
      correlationId: "corr-1",
    });
    expect(typeof message.value).toBe("string");
    expect(JSON.parse(String(message.value))).toEqual({
      eventId: row.id,
      eventType: "ItemCreated",
      schemaVersion: 2,
      occurredAt: "2026-09-22T12:00:00.000Z",
      aggregateId: item.id,
      correlationId: "corr-1",
      payload: row.payload,
    });
  });
});
