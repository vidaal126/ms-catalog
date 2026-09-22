import type {
  OutboxEvent,
  Prisma,
} from "@infrastructure/database/generated";

export interface EventEnvelope {
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly occurredAt: string;
  readonly aggregateId: string;
  readonly correlationId: string;
  readonly payload: Prisma.JsonValue;
}

export const EVENT_HEADERS = {
  eventType: "eventType",
  schemaVersion: "schemaVersion",
  correlationId: "correlationId",
} as const;

export interface OutboundMessage {
  readonly topic: string;
  readonly key: string;
  readonly value: string;
  readonly headers: Readonly<Record<string, string>>;
}

export function topicFor(eventType: string): string {
  return `catalog.${eventType}`;
}

// O id da linha do outbox e o eventId: estavel entre republicacoes, o que
// permite ao consumer deduplicar quando o publisher reenvia (at-least-once).
export function toOutboundMessage(event: OutboxEvent): OutboundMessage {
  const envelope: EventEnvelope = {
    eventId: event.id,
    eventType: event.eventType,
    schemaVersion: event.schemaVersion,
    occurredAt: event.createdAt.toISOString(),
    aggregateId: event.aggregateId,
    correlationId: event.correlationId,
    payload: event.payload,
  };

  return {
    topic: topicFor(event.eventType),
    key: event.aggregateId,
    value: JSON.stringify(envelope),
    headers: {
      [EVENT_HEADERS.eventType]: event.eventType,
      [EVENT_HEADERS.schemaVersion]: String(event.schemaVersion),
      [EVENT_HEADERS.correlationId]: event.correlationId,
    },
  };
}
