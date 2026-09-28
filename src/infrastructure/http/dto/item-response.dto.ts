export class DimensionsResponseDto {
  readonly lengthCm!: number;
  readonly widthCm!: number;
  readonly heightCm!: number;
}

export class ItemResponseDto {
  readonly id!: string;
  readonly sku!: string;
  readonly name!: string;
  readonly description!: string | null;
  readonly unitPrice!: number;
  readonly weightKg!: number;
  readonly dimensions!: DimensionsResponseDto;
  readonly createdAt!: string;
}

export class PaginatedItemsResponseDto {
  readonly items!: ItemResponseDto[];
  readonly total!: number;
  readonly page!: number;
  readonly pageSize!: number;
}
