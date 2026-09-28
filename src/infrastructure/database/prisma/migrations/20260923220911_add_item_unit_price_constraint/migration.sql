-- Prisma nao modela CHECK constraints: escrito a mao.
ALTER TABLE "items"
  ADD CONSTRAINT "items_unit_price_positive" CHECK ("unitPrice" > 0);
