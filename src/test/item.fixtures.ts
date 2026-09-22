import type { CreateItemProps } from "@domain/entities/item.entity";

export function buildCreateItemProps(
  overrides: Partial<CreateItemProps> = {},
): CreateItemProps {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    sku: "BOX-001",
    name: "Caixa",
    description: "Caixa de papelao",
    unitPrice: 10.5,
    weightKg: 1.25,
    dimensions: { lengthCm: 30, widthCm: 20, heightCm: 10.5 },
    createdAt: new Date("2026-09-22T12:00:00.000Z"),
    ...overrides,
  };
}
