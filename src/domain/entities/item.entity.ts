import { InvariantViolationError } from "@domain/errors/domain.error";
import { ItemCreatedEvent } from "@domain/events/item-created.event";
import {
  Dimensions,
  DimensionsProps,
} from "@domain/value-objects/dimensions.value-object";
import { AggregateRoot } from "./aggregate-root";

export class InvalidItemPriceError extends InvariantViolationError {
  constructor() {
    super("unitPrice deve ser maior que zero");
  }
}

export class InvalidItemWeightError extends InvariantViolationError {}

interface ItemProps {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly description?: string;
  readonly unitPrice: number;
  readonly weightKg: number;
  readonly dimensions: DimensionsProps;
  readonly createdAt: Date;
}

export type CreateItemProps = ItemProps;

export type RestoreItemProps = ItemProps;

export class ItemEntity extends AggregateRoot<ItemCreatedEvent> {
  private static readonly WEIGHT_SCALE = 3;
  private static readonly MIN_WEIGHT_KG = 0.001;
  private static readonly MAX_WEIGHT_KG = 1000;

  private constructor(
    readonly id: string,
    readonly sku: string,
    readonly name: string,
    readonly description: string | undefined,
    readonly unitPrice: number,
    readonly weightKg: number,
    readonly dimensions: Dimensions,
    readonly createdAt: Date,
  ) {
    super();
  }

  static create(props: CreateItemProps): ItemEntity {
    if (props.unitPrice <= 0) {
      throw new InvalidItemPriceError();
    }

    ItemEntity.assertValidWeight(props.weightKg);

    const item = new ItemEntity(
      props.id,
      props.sku,
      props.name,
      props.description,
      props.unitPrice,
      props.weightKg,
      Dimensions.create(props.dimensions),
      props.createdAt,
    );

    item.record(
      new ItemCreatedEvent(
        item.id,
        item.createdAt,
        item.sku,
        item.name,
        item.unitPrice,
        item.weightKg,
        item.dimensions.toPrimitives(),
      ),
    );

    return item;
  }

  static restore(props: RestoreItemProps): ItemEntity {
    return new ItemEntity(
      props.id,
      props.sku,
      props.name,
      props.description,
      props.unitPrice,
      props.weightKg,
      Dimensions.create(props.dimensions),
      props.createdAt,
    );
  }

  private static assertValidWeight(weightKg: number): void {
    if (!Number.isFinite(weightKg)) {
      throw new InvalidItemWeightError("weightKg must be a finite number");
    }

    if (weightKg < ItemEntity.MIN_WEIGHT_KG) {
      throw new InvalidItemWeightError(
        `weightKg must be at least ${ItemEntity.MIN_WEIGHT_KG}`,
      );
    }

    if (weightKg > ItemEntity.MAX_WEIGHT_KG) {
      throw new InvalidItemWeightError(
        `weightKg must not exceed ${ItemEntity.MAX_WEIGHT_KG}`,
      );
    }

    const [, decimals = ""] = weightKg.toString().split(".");
    if (decimals.length > ItemEntity.WEIGHT_SCALE) {
      throw new InvalidItemWeightError(
        `weightKg must have at most ${ItemEntity.WEIGHT_SCALE} decimal places`,
      );
    }
  }
}
