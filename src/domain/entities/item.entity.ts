import { BaseEntity } from "./base.entity";

export class InvalidItemPriceError extends Error {
  constructor() {
    super("unitPrice deve ser maior que zero");
    this.name = "InvalidItemPriceError";
  }
}

export class ItemEntity {
  readonly id?: string;
  readonly sku: string;
  readonly name: string;
  readonly description?: string;
  readonly unitPrice: number;
  readonly createdAt: Date;

  private constructor(props: {
    id?: string;
    sku: string;
    name: string;
    description?: string;
    unitPrice: number;
    createdAt: Date;
  }) {
    this.id = props.id;
    this.sku = props.sku;
    this.name = props.name;
    this.description = props.description;
    this.unitPrice = props.unitPrice;
    this.createdAt = props.createdAt;
  }

  static create(props: {
    id?: string;
    sku: string;
    name: string;
    description?: string;
    unitPrice: number;
    createdAt: Date;
  }): ItemEntity {
    if (props.unitPrice <= 0) {
      throw new InvalidItemPriceError();
    }
    return new ItemEntity(props);
  }
}
