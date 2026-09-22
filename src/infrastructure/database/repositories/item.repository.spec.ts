import { ItemEntity } from "@domain/entities/item.entity";
import { ItemAlreadyExistsError } from "@domain/errors/item.errors";
import { Prisma } from "@infrastructure/database/generated";
import type { PrismaService } from "@infrastructure/database/prisma/prisma.service";
import { buildCreateItemProps } from "../../../test/item.fixtures";
import { ItemRepositoryPrisma } from "./item.repository";

function prismaRejectingWith(error: Error): PrismaService {
  const fake: Pick<PrismaService, "$transaction"> = {
    $transaction: jest.fn().mockRejectedValue(error),
  };
  return fake as PrismaService;
}

describe("ItemRepositoryPrisma.create", () => {
  const item = (): ItemEntity => ItemEntity.create(buildCreateItemProps());

  it("traduz P2002 para ItemAlreadyExistsError", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    const repository = new ItemRepositoryPrisma(prismaRejectingWith(p2002));

    await expect(repository.create(item())).rejects.toEqual(
      new ItemAlreadyExistsError("BOX-001"),
    );
  });

  it("repassa outros erros de infraestrutura sem traduzir", async () => {
    const down = new Error("connection refused");
    const repository = new ItemRepositoryPrisma(prismaRejectingWith(down));

    await expect(repository.create(item())).rejects.toBe(down);
  });
});
