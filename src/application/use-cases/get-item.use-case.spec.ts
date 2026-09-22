import { ItemEntity } from "@domain/entities/item.entity";
import { ItemNotFoundError } from "@domain/errors/item.errors";
import {
  buildCreateItemProps,
  InMemoryItemRepository,
} from "../../test/item.fixtures";
import { GetItemUseCase } from "./get-item.use-case";

describe("GetItemUseCase", () => {
  it("retorna o item existente", async () => {
    const repository = new InMemoryItemRepository();
    const item = ItemEntity.restore(buildCreateItemProps());
    repository.items.push(item);

    await expect(new GetItemUseCase(repository).execute(item.id)).resolves.toBe(item);
  });

  it("lanca ItemNotFoundError quando o item nao existe", async () => {
    const useCase = new GetItemUseCase(new InMemoryItemRepository());

    await expect(useCase.execute("missing")).rejects.toBeInstanceOf(
      ItemNotFoundError,
    );
  });
});
