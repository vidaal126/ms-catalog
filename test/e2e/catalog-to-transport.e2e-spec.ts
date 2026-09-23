import { resolve } from "node:path";
import { KafkaContainer, type StartedKafkaContainer } from "@testcontainers/kafka";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import {
  GenericContainer,
  Network,
  type StartedNetwork,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { z } from "zod";
import { migrateDatabase, postJson, type RunningCatalogApp, startCatalogApp } from "../support/catalog-app";
import { KafkaTestClient, waitFor } from "../support/kafka-test-client";

// Repositorio do ms-transport: irmao deste por padrao (mesmo layout do
// docker compose), configuravel por TRANSPORT_CONTEXT.
const TRANSPORT_CONTEXT = resolve(
  __dirname,
  "../..",
  process.env.TRANSPORT_CONTEXT ?? "../ms-transport",
);
const TOPIC = "catalog.ItemCreated";
const TRANSPORT_HTTP_PORT = 8080;

const createdItemSchema = z.object({ id: z.uuid() });

// Fluxo completo: POST no ms-catalog (em processo) -> outbox -> Kafka ->
// consumer do ms-transport (imagem buildada do Dockerfile, em container) ->
// read model, conferido pelo GET /catalog-items/:itemId do ms-transport.
describe("e2e: item criado no catalogo chega ao read model do transporte", () => {
  let network: StartedNetwork;
  let kafkaContainer: StartedKafkaContainer;
  let catalogDb: StartedPostgreSqlContainer;
  let transportDb: StartedPostgreSqlContainer;
  let rabbitmq: StartedTestContainer;
  let transport: StartedTestContainer;
  let catalog: RunningCatalogApp;
  let transportUrl: string;

  beforeAll(async () => {
    network = await new Network().start();

    const [transportMigrateImage, transportImage] = await Promise.all([
      GenericContainer.fromDockerfile(TRANSPORT_CONTEXT).withTarget("migrate").build(),
      GenericContainer.fromDockerfile(TRANSPORT_CONTEXT).withTarget("production").build(),
    ]);

    [kafkaContainer, catalogDb, transportDb, rabbitmq] = await Promise.all([
      new KafkaContainer("confluentinc/cp-kafka:7.6.1")
        .withKraft()
        .withNetwork(network)
        .withNetworkAliases("kafka")
        .start(),
      new PostgreSqlContainer("postgres:16-alpine").start(),
      new PostgreSqlContainer("postgres:16-alpine")
        .withNetwork(network)
        .withNetworkAliases("transport-db")
        .start(),
      new GenericContainer("rabbitmq:3.13-alpine")
        .withNetwork(network)
        .withNetworkAliases("rabbitmq")
        .withEnvironment({ RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS: "-rabbit loopback_users []" })
        .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
        .start(),
    ]);

    const hostBroker = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`;
    await new KafkaTestClient(hostBroker).createTopic(TOPIC);

    // Mesma URL interna que o docker compose usa para o transport-db.
    const transportDbUrl = `postgresql://${transportDb.getUsername()}:${transportDb.getPassword()}@transport-db:5432/${transportDb.getDatabase()}?schema=public`;

    await transportMigrateImage
      .withNetwork(network)
      .withEnvironment({ DATABASE_URL: transportDbUrl })
      .withWaitStrategy(Wait.forOneShotStartup())
      .start();

    transport = await transportImage
      .withNetwork(network)
      .withEnvironment({
        DATABASE_URL: transportDbUrl,
        KAFKA_BROKER: "kafka:9092",
        RABBITMQ_URL: "amqp://guest:guest@rabbitmq:5672",
        LOG_LEVEL: "warn",
      })
      .withExposedPorts(TRANSPORT_HTTP_PORT)
      .withWaitStrategy(Wait.forHttp("/health/ready", TRANSPORT_HTTP_PORT).forStatusCode(200))
      .start();
    transportUrl = `http://${transport.getHost()}:${transport.getMappedPort(TRANSPORT_HTTP_PORT)}`;

    migrateDatabase(catalogDb.getConnectionUri());
    catalog = await startCatalogApp({
      DATABASE_URL: catalogDb.getConnectionUri(),
      KAFKA_BROKER: hostBroker,
      OUTBOX_POLL_INTERVAL_MS: "200",
    });
  });

  afterAll(async () => {
    await catalog?.app.close();
    await transport?.stop();
    await Promise.all([kafkaContainer?.stop(), catalogDb?.stop(), transportDb?.stop(), rabbitmq?.stop()]);
    await network?.stop();
  });

  it("POST /items no catalogo aparece no GET /catalog-items/:itemId do transporte", async () => {
    const created = await postJson(
      `${catalog.baseUrl}/items`,
      {
        sku: "E2E-001",
        name: "Caixa e2e",
        unitPrice: 10,
        weightKg: 1.234,
        dimensions: { lengthCm: 10.5, widthCm: 20, heightCm: 30.25 },
      },
      { "x-correlation-id": "e2e-corr-1" },
    );
    expect(created.status).toBe(201);
    const { id } = createdItemSchema.parse(created.body);

    let readModel: unknown;
    await waitFor(
      "item no read model do ms-transport",
      async () => {
        const response = await fetch(`${transportUrl}/catalog-items/${id}`);
        if (response.status !== 200) return false;
        readModel = await response.json();
        return true;
      },
      60_000,
    );

    expect(readModel).toMatchObject({
      itemId: id,
      sku: "E2E-001",
      weightKg: 1.234,
      dimensions: { lengthCm: 10.5, widthCm: 20, heightCm: 30.25 },
    });
  });
});
