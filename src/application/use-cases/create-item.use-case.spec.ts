import type { IdGenerator } from "@application/ports/id-generator.port";
import { ItemAlreadyExistsError } from "@domain/errors/item.errors";
import { ItemCreatedEvent } from "@domain/events/item-created.event";
import { InMemoryItemRepository } from "../../test/item.fixtures";
import { CreateItemInput, CreateItemUseCase } from "./create-item.use-case";

const GENERATED_ID = "22222222-2222-4222-8222-222222222222";

const fixedIdGenerator: IdGenerator = { generate: () => GENERATED_ID };

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
    useCase = new CreateItemUseCase(repository, fixedIdGenerator);
  });

  it("cria o item com id do IdGenerator e entrega o evento ao repositorio", async () => {
    const item = await useCase.execute(input, { correlationId: "corr-1" });

    expect(item.id).toBe(GENERATED_ID);
    expect(repository.items).toEqual([item]);
    expect(repository.contexts).toEqual([{ correlationId: "corr-1" }]);

    const events = item.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ItemCreatedEvent);
    expect(events[0]?.aggregateId).toBe(GENERATED_ID);
  });

  it("propaga ItemAlreadyExistsError do repositorio", async () => {
    repository.createError = new ItemAlreadyExistsError(input.sku);

    await expect(
      useCase.execute(input, { correlationId: "corr-1" }),
    ).rejects.toBeInstanceOf(ItemAlreadyExistsError);
  });
});
