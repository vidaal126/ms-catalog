import type { DimensionsProps } from "@domain/value-objects/dimensions.value-object";
import type { DomainEvent } from "./domain-event";

export class ItemCreatedEvent implements DomainEvent {
  static readonly EVENT_TYPE = "ItemCreated";

  readonly eventType = ItemCreatedEvent.EVENT_TYPE;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly sku: string,
    readonly name: string,
    readonly unitPrice: number,
    readonly weightKg: number,
    readonly dimensions: DimensionsProps,
  ) {}
}
