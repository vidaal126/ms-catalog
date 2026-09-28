import { ItemAlreadyExistsError } from "@domain/errors/item.errors";
import { ItemCreatedEvent } from "@domain/events/item-created.event";
import { InMemoryItemRepository } from "../../test/item.fixtures";
import { CreateItemInput, CreateItemUseCase } from "./create-item.use-case";

const input: CreateItemInput = {
  sku: "BOX-001",
  name: "Caixa",
  unitPrice: 10.5,
  weightKg: 1.25,
  dimensions: { lengthCm: 30, widthCm: 20, heightCm: 10.5 },
};

describe("CreateItemUseCase", () => {
  let repository: InMemoryItemRepository;
  let useCase: CreateItemUseCase;

  beforeEach(() => {
    repository = new InMemoryItemRepository();
    useCase = new CreateItemUseCase(repository);
  });

  it("cria o item com id gerado no dominio e entrega o evento ao repositorio", async () => {
    const item = await useCase.execute(input, { correlationId: "corr-1" });

    expect(item.id).toEqual(expect.any(String));
    expect(repository.items).toEqual([item]);
    expect(repository.contexts).toEqual([{ correlationId: "corr-1" }]);

    const events = item.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ItemCreatedEvent);
    expect(events[0]?.aggregateId).toBe(item.id);
  });

  it("propaga ItemAlreadyExistsError do repositorio", async () => {
    repository.createError = new ItemAlreadyExistsError(input.sku);

    await expect(
      useCase.execute(input, { correlationId: "corr-1" }),
    ).rejects.toBeInstanceOf(ItemAlreadyExistsError);
  });
});
