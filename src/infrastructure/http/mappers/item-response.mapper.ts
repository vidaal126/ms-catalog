import type { ItemEntity } from "@domain/entities/item.entity";
import type { ListItemsOutput } from "@application/use-cases/list-items.use-case";
import type {
  ItemResponseDto,
  PaginatedItemsResponseDto,
} from "@infrastructure/http/dto/item-response.dto";

export function toItemResponse(item: ItemEntity): ItemResponseDto {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description ?? null,
    unitPrice: item.unitPrice,
    weightKg: item.weightKg,
    dimensions: item.dimensions.toPrimitives(),
    createdAt: item.createdAt.toISOString(),
  };
}

export function toPaginatedItemsResponse(
  output: ListItemsOutput,
): PaginatedItemsResponseDto {
  return {
    items: output.items.map(toItemResponse),
    total: output.total,
    page: output.page,
    pageSize: output.pageSize,
  };
}
