import type { Prisma } from "@infrastructure/database/generated";
import { ItemCreatedEvent } from "@domain/events/item-created.event";
import type { PersistenceContext } from "@domain/repositories/item.repository";

// Versao do contrato publicado de ItemCreated. v1 levava schemaVersion dentro
// do payload; a partir da v2 ela vive no envelope (coluna schemaVersion).
export const ITEM_CREATED_SCHEMA_VERSION = 2;

export function toOutboxEventData(
  event: ItemCreatedEvent,
  context: PersistenceContext,
): Prisma.OutboxEventCreateManyInput {
  const payload: Prisma.InputJsonObject = {
    id: event.aggregateId,
    sku: event.sku,
    name: event.name,
    unitPrice: event.unitPrice,
    weightKg: event.weightKg,
    dimensions: {
      lengthCm: event.dimensions.lengthCm,
      widthCm: event.dimensions.widthCm,
      heightCm: event.dimensions.heightCm,
    },
  };

  return {
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    schemaVersion: ITEM_CREATED_SCHEMA_VERSION,
    correlationId: context.correlationId,
    payload,
    createdAt: event.occurredAt,
  };
}
