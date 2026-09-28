import { EntityConflictError, EntityNotFoundError } from "./domain.error";

export class ItemNotFoundError extends EntityNotFoundError {
  constructor(readonly itemId: string) {
    super(`Item com id ${itemId} nao encontrado`);
  }
}

export class ItemAlreadyExistsError extends EntityConflictError {
  constructor(readonly sku: string) {
    super(`Item com SKU ${sku} ja existe`);
  }
}
