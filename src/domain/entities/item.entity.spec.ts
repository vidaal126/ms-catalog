import { InvariantViolationError } from "@domain/errors/domain.error";
import { ItemCreatedEvent } from "@domain/events/item-created.event";
import { InvalidDimensionsError } from "@domain/value-objects/dimensions.value-object";
import {
  buildCreateItemProps,
  buildRestoreItemProps,
} from "../../test/item.fixtures";
import {
  InvalidItemPriceError,
  InvalidItemWeightError,
  ItemEntity,
} from "./item.entity";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("ItemEntity", () => {
  describe("create", () => {
    it("registra ItemCreated com os dados do item", () => {
      const props = buildCreateItemProps();

      const item = ItemEntity.create(props);
      const events = item.pullDomainEvents();

      expect(item.id).toMatch(UUID_PATTERN);

      expect(events).toHaveLength(1);
      const [event] = events;
      expect(event).toBeInstanceOf(ItemCreatedEvent);
      expect(event).toMatchObject({
        eventType: "ItemCreated",
        aggregateId: item.id,
        occurredAt: props.createdAt,
        sku: props.sku,
        name: props.name,
        unitPrice: props.unitPrice,
        weightKg: props.weightKg,
        dimensions: props.dimensions,
      });
    });

    it("gera um id novo a cada criacao", () => {
      const first = ItemEntity.create(buildCreateItemProps());
      const second = ItemEntity.create(buildCreateItemProps());

      expect(first.id).not.toBe(second.id);
    });

    it("limpa os eventos depois de pullDomainEvents", () => {
      const item = ItemEntity.create(buildCreateItemProps());

      item.pullDomainEvents();

      expect(item.pullDomainEvents()).toHaveLength(0);
    });

    it.each([0, -1, 0.001, 1.234, 100_000_000, Number.NaN, Number.POSITIVE_INFINITY])(
      "rejeita unitPrice %p",
      (unitPrice) => {
        expect(() => ItemEntity.create(buildCreateItemProps({ unitPrice }))).toThrow(
          InvalidItemPriceError,
        );
      },
    );

    it.each([0.01, 99_999_999.99])("aceita unitPrice no limite %p", (unitPrice) => {
      expect(ItemEntity.create(buildCreateItemProps({ unitPrice })).unitPrice).toBe(
        unitPrice,
      );
    });

    it.each([0, 1000.001, 1.2345, Number.NaN])("rejeita weightKg %p", (weightKg) => {
      expect(() => ItemEntity.create(buildCreateItemProps({ weightKg }))).toThrow(
        InvalidItemWeightError,
      );
    });

    it("rejeita dimensoes invalidas", () => {
      const dimensions = { lengthCm: 0, widthCm: 20, heightCm: 10 };

      expect(() => ItemEntity.create(buildCreateItemProps({ dimensions }))).toThrow(
        InvalidDimensionsError,
      );
    });

    it.each([{ unitPrice: 0 }, { weightKg: 0 }])(
      "classifica %p como InvariantViolationError",
      (override) => {
        let caught: unknown;
        try {
          ItemEntity.create(buildCreateItemProps(override));
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(InvariantViolationError);
      },
    );
  });

  describe("restore", () => {
    it("nao registra eventos", () => {
      const props = buildRestoreItemProps();
      const item = ItemEntity.restore(props);

      expect(item.id).toBe(props.id);
      expect(item.pullDomainEvents()).toHaveLength(0);
    });
  });
});
