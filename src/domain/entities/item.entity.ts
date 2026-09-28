import { randomUUID } from "node:crypto";
import { InvariantViolationError } from "@domain/errors/domain.error";
import { ItemCreatedEvent } from "@domain/events/item-created.event";
import {
  Dimensions,
  DimensionsProps,
} from "@domain/value-objects/dimensions.value-object";
import { AggregateRoot } from "./aggregate-root";

export class InvalidItemPriceError extends InvariantViolationError {}

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

export type CreateItemProps = Omit<ItemProps, "id">;

export type RestoreItemProps = ItemProps;

export class ItemEntity extends AggregateRoot<ItemCreatedEvent> {
  // Limites de DECIMAL(10,2): o banco rejeitaria com erro de infraestrutura.
  private static readonly PRICE_SCALE = 2;
  private static readonly MIN_UNIT_PRICE = 0.01;
  private static readonly MAX_UNIT_PRICE = 99_999_999.99;
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
    ItemEntity.assertValidPrice(props.unitPrice);
    ItemEntity.assertValidWeight(props.weightKg);

    const item = new ItemEntity(
      randomUUID(),
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

  private static assertValidPrice(unitPrice: number): void {
    if (!Number.isFinite(unitPrice)) {
      throw new InvalidItemPriceError("unitPrice must be a finite number");
    }

    if (unitPrice < ItemEntity.MIN_UNIT_PRICE) {
      throw new InvalidItemPriceError(
        `unitPrice must be at least ${ItemEntity.MIN_UNIT_PRICE}`,
      );
    }

    if (unitPrice > ItemEntity.MAX_UNIT_PRICE) {
      throw new InvalidItemPriceError(
        `unitPrice must not exceed ${ItemEntity.MAX_UNIT_PRICE}`,
      );
    }

    if (!ItemEntity.hasMaxScale(unitPrice, ItemEntity.PRICE_SCALE)) {
      throw new InvalidItemPriceError(
        `unitPrice must have at most ${ItemEntity.PRICE_SCALE} decimal places`,
      );
    }
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

    if (!ItemEntity.hasMaxScale(weightKg, ItemEntity.WEIGHT_SCALE)) {
      throw new InvalidItemWeightError(
        `weightKg must have at most ${ItemEntity.WEIGHT_SCALE} decimal places`,
      );
    }
  }

  private static hasMaxScale(value: number, scale: number): boolean {
    const [, decimals = ""] = value.toString().split(".");
    return decimals.length <= scale;
  }
}
