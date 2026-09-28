import { ItemEntity } from "@domain/entities/item.entity";
import {
  buildRestoreItemProps,
  InMemoryItemRepository,
} from "../../test/item.fixtures";
import {
  DEFAULT_PAGE_SIZE,
  ListItemsUseCase,
  MAX_PAGE_SIZE,
  resolvePageSize,
} from "./list-items.use-case";

describe("resolvePageSize", () => {
  it.each([
    [undefined, DEFAULT_PAGE_SIZE],
    [0, DEFAULT_PAGE_SIZE],
    [-5, DEFAULT_PAGE_SIZE],
    [10, 10],
    [MAX_PAGE_SIZE + 1, MAX_PAGE_SIZE],
  ])("limit %p -> %p", (limit, expected) => {
    expect(resolvePageSize(limit)).toBe(expected);
  });
});

describe("ListItemsUseCase", () => {
  it("retorna itens da pagina com total, page e pageSize", async () => {
    const repository = new InMemoryItemRepository();
    for (let i = 0; i < 3; i++) {
      repository.items.push(
        ItemEntity.restore(buildRestoreItemProps({ id: `id-${i}`, sku: `SKU-${i}` })),
      );
    }

    const output = await new ListItemsUseCase(repository).execute({ page: 2, limit: 2 });

    expect(output.total).toBe(3);
    expect(output.page).toBe(2);
    expect(output.pageSize).toBe(2);
    expect(output.items.map((i) => i.id)).toEqual(["id-2"]);
  });

  it("usa pagina 1 e page size padrao sem parametros", async () => {
    const output = await new ListItemsUseCase(new InMemoryItemRepository()).execute({});

    expect(output).toEqual({ items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });
});
