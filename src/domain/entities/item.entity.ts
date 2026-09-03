import {
  Dimensions,
  DimensionsProps,
} from "@domain/value-objects/dimensions.value-object";

export class InvalidItemPriceError extends Error {
  constructor() {
    super("unitPrice deve ser maior que zero");
    this.name = "InvalidItemPriceError";
  }
}

export class InvalidItemWeightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidItemWeightError";
  }
}

interface ItemBaseProps {
  readonly sku: string;
  readonly name: string;
  readonly description?: string;
  readonly unitPrice: number;
  readonly weightKg: number;
  readonly dimensions: DimensionsProps;
  readonly createdAt: Date;
}

export interface CreateItemProps extends ItemBaseProps {
  readonly id?: string;
}

export interface RestoreItemProps extends ItemBaseProps {
  readonly id: string;
}

export class ItemEntity {
  private static readonly WEIGHT_SCALE = 3;
  private static readonly MIN_WEIGHT_KG = 0.001;
  private static readonly MAX_WEIGHT_KG = 1000;

  private constructor(
    readonly id: string | undefined,
    readonly sku: string,
    readonly name: string,
    readonly description: string | undefined,
    readonly unitPrice: number,
    readonly weightKg: number,
    readonly dimensions: Dimensions,
    readonly createdAt: Date,
  ) {}

  static create(props: CreateItemProps): ItemEntity {
    if (props.unitPrice <= 0) {
      throw new InvalidItemPriceError();
    }

    ItemEntity.assertValidWeight(props.weightKg);

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
