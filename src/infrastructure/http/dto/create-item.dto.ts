import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class DimensionsDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000)
  @Type(() => Number)
  readonly lengthCm!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000)
  @Type(() => Number)
  readonly widthCm!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000)
  @Type(() => Number)
  readonly heightCm!: number;
}

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  readonly sku!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  readonly unitPrice!: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1000)
  @Type(() => Number)
  readonly weightKg!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => DimensionsDto)
  readonly dimensions!: DimensionsDto;
}
