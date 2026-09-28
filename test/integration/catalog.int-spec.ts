import { KafkaContainer, type StartedKafkaContainer } from "@testcontainers/kafka";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { z } from "zod";
import { migrateDatabase, postJson, type RunningCatalogApp, startCatalogApp } from "../support/catalog-app";
import { sampleValue } from "../../src/test/metrics.helpers";
import { KafkaTestClient, waitFor } from "../support/kafka-test-client";

const TOPIC = "catalog.ItemCreated";
// Acima dos POSTs feitos pelos outros testes (sem X-Forwarded-For).
const CREATE_ITEM_LIMIT = 10;

const itemResponseSchema = z.object({ id: z.uuid(), sku: z.string() });

const envelopeSchema = z.object({
  eventId: z.uuid(),
  eventType: z.literal("ItemCreated"),
  schemaVersion: z.literal(2),
  occurredAt: z.iso.datetime(),
  aggregateId: z.uuid(),
  correlationId: z.string(),
  payload: z.object({
    id: z.uuid(),
    sku: z.string(),
    weightKg: z.number(),
    dimensions: z.object({ lengthCm: z.number(), widthCm: z.number(), heightCm: z.number() }),
  }),
});

function itemBody(sku: string): Record<string, unknown> {
  return {
    sku,
    name: "Caixa",
    unitPrice: 24.9,
    weightKg: 0.75,
    dimensions: { lengthCm: 40, widthCm: 30, heightCm: 25 },
  };
}

// Postgres e Kafka reais: POST -> transacao item + outbox -> publisher ->
// Kafka com envelope v2, duplicidade (409) e Idempotency-Key.
describe("ms-catalog: criacao de item e publicacao via outbox (integracao)", () => {
  let postgres: StartedPostgreSqlContainer;
  let kafkaContainer: StartedKafkaContainer;
  let kafka: KafkaTestClient;
  let running: RunningCatalogApp;

  beforeAll(async () => {
    [postgres, kafkaContainer] = await Promise.all([
      new PostgreSqlContainer("postgres:16-alpine").start(),
      // Igual ao compose: topico so existe se for criado explicitamente.
      new KafkaContainer("confluentinc/cp-kafka:7.6.1")
        .withKraft()
        .withEnvironment({ KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false" })
        .start(),
    ]);
    const broker = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`;
    kafka = new KafkaTestClient(broker);
    await kafka.createTopic(TOPIC);

    migrateDatabase(postgres.getConnectionUri());
    running = await startCatalogApp({
      DATABASE_URL: postgres.getConnectionUri(),
      KAFKA_BROKER: broker,
      OUTBOX_POLL_INTERVAL_MS: "200",
      THROTTLE_CREATE_ITEM_LIMIT: String(CREATE_ITEM_LIMIT),
    });
  });

  afterAll(async () => {
    await running?.app.close();
    await Promise.all([postgres?.stop(), kafkaContainer?.stop()]);
  });

  it("POST /items grava o item e publica ItemCreated com envelope v2, key e headers", async () => {
    const created = await postJson(`${running.baseUrl}/items`, itemBody("INT-001"), {
      "x-correlation-id": "int-corr-1",
    });

    expect(created.status).toBe(201);
    expect(created.headers.get("x-correlation-id")).toBe("int-corr-1");
    const item = itemResponseSchema.parse(created.body);

    const [message] = await kafka.readFromBeginning(TOPIC, 1, 30_000);
    expect(message).toBeDefined();
    expect(message?.key).toBe(item.id);
    expect(message?.headers).toEqual({
      eventType: "ItemCreated",
      schemaVersion: "2",
      correlationId: "int-corr-1",
    });
    const envelope = envelopeSchema.parse(JSON.parse(message?.value ?? ""));
    expect(envelope).toMatchObject({
      aggregateId: item.id,
      correlationId: "int-corr-1",
      payload: { id: item.id, sku: "INT-001", weightKg: 0.75 },
    });
  });

  it("POST com SKU duplicado retorna 409", async () => {
    const duplicate = await postJson(`${running.baseUrl}/items`, itemBody("INT-001"));

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject({ error: "ItemAlreadyExistsError" });
  });

  it("unitPrice acima do limite do DECIMAL(10,2) retorna 400, nao 500 nem 422", async () => {
    const response = await postJson(`${running.baseUrl}/items`, {
      ...itemBody("INT-PRICE-MAX"),
      unitPrice: 100_000_000,
    });

    expect(response.status).toBe(400);
  });

  it("mesma Idempotency-Key e mesmo corpo devolvem a resposta original sem criar outro item", async () => {
    const body = itemBody("INT-IDEM-1");
    const headers = { "idempotency-key": "int-key-1" };

    const first = await postJson(`${running.baseUrl}/items`, body, headers);
    const replay = await postJson(`${running.baseUrl}/items`, body, headers);
    const mismatch = await postJson(`${running.baseUrl}/items`, itemBody("INT-IDEM-2"), headers);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotent-replayed")).toBe("true");
    expect(replay.body).toEqual(first.body);
    expect(mismatch.status).toBe(422);

    const list = await fetch(`${running.baseUrl}/items?limit=100`);
    const page = z.object({ items: z.array(z.object({ sku: z.string() })), total: z.number() }).parse(await list.json());
    expect(page.items.filter((i) => i.sku === "INT-IDEM-1")).toHaveLength(1);
    expect(page.items.some((i) => i.sku === "INT-IDEM-2")).toBe(false);
  });

  it("outbox drena: todos os eventos criados chegam ao Kafka", async () => {
    // INT-001 e INT-IDEM-1: o 409, o replay e o 422 nao geram evento.
    await waitFor("dois eventos no topico", async () =>
      (await kafka.readFromBeginning(TOPIC, 2, 5_000)).length === 2,
    );
    const messages = await kafka.readFromBeginning(TOPIC, 3, 5_000);
    expect(messages).toHaveLength(2);
  });

  it("GET /metrics expoe latencia por rota e eventos publicados pelo outbox", async () => {
    const response = await fetch(`${running.baseUrl}/metrics`);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(
      sampleValue(text, "http_request_duration_seconds_count", { method: "POST", route: "/items", status_code: "201" }),
    ).toBeGreaterThanOrEqual(1);
    expect(sampleValue(text, "outbox_events_published_total", { event_type: "ItemCreated", service: "ms-catalog" })).toBe(2);
    expect(sampleValue(text, "outbox_pending_events", {})).toBe(0);
  });

  // Roda por ultimo: esgota o balde de POST /items de um cliente. Corpo
  // invalido (400) para nao gravar itens nem eventos no outbox.
  it("throttler conta por cliente (X-Forwarded-For do gateway), nao pelo proxy", async () => {
    const createFrom = async (clientIp: string): Promise<number> => {
      const response = await postJson(`${running.baseUrl}/items`, {}, { "x-forwarded-for": clientIp });
      return response.status;
    };

    for (let attempt = 0; attempt < CREATE_ITEM_LIMIT; attempt++) {
      expect(await createFrom("203.0.113.10")).toBe(400);
    }
    expect(await createFrom("203.0.113.10")).toBe(429);
    expect(await createFrom("203.0.113.20")).toBe(400);
  });
});
