import { InvalidEnvironmentError, validateEnv } from "./env";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5433/db",
  KAFKA_BROKER: "localhost:9092",
};

describe("validateEnv", () => {
  it("aplica defaults e converte tipos", () => {
    const env = validateEnv({ ...valid, PORT: "4000" });

    expect(env.PORT).toBe(4000);
    expect(env.OUTBOX_POLL_INTERVAL_MS).toBe(2000);
    expect(env.IDEMPOTENCY_TTL_HOURS).toBe(24);
    expect(env.KAFKA_BROKER).toEqual(["localhost:9092"]);
  });

  it("aceita lista de brokers separada por virgula", () => {
    const env = validateEnv({ ...valid, KAFKA_BROKER: "a:9092, b:9093" });

    expect(env.KAFKA_BROKER).toEqual(["a:9092", "b:9093"]);
  });

  it("falha listando todas as variaveis invalidas", () => {
    const attempt = (): unknown =>
      validateEnv({ KAFKA_BROKER: "sem-porta", PORT: "abc" });

    expect(attempt).toThrow(InvalidEnvironmentError);
    expect(attempt).toThrow(/DATABASE_URL/);
    expect(attempt).toThrow(/KAFKA_BROKER/);
    expect(attempt).toThrow(/PORT/);
  });
});
