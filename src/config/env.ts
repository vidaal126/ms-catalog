import { z } from "zod";

const positiveInt = z.coerce.number().int().positive();

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "deve ser uma URL postgresql://"),

  // Lista separada por virgula: "host1:9092,host2:9092".
  KAFKA_BROKER: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((broker) => broker.trim()))
    .pipe(z.array(z.string().regex(/^[^\s:]+:\d+$/, "formato host:porta")).min(1)),
  KAFKA_CLIENT_ID: z.string().min(1).default("ms-catalog"),

  OUTBOX_POLL_INTERVAL_MS: positiveInt.default(2000),
  OUTBOX_BATCH_SIZE: positiveInt.max(1000).default(20),

  THROTTLE_DEFAULT_TTL_MS: positiveInt.default(60_000),
  THROTTLE_DEFAULT_LIMIT: positiveInt.default(100),
  THROTTLE_CREATE_ITEM_TTL_MS: positiveInt.default(60_000),
  THROTTLE_CREATE_ITEM_LIMIT: positiveInt.default(20),

  IDEMPOTENCY_TTL_HOURS: positiveInt.default(24),
  IDEMPOTENCY_LOCK_TIMEOUT_MS: positiveInt.default(30_000),
  IDEMPOTENCY_CLEANUP_INTERVAL_MS: positiveInt.default(3_600_000),

  SHUTDOWN_TIMEOUT_MS: positiveInt.default(10_000),
});

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvironmentError extends Error {}

// Usado pelo ConfigModule.validate: falha no bootstrap, antes de qualquer
// modulo instanciar conexoes, com a lista completa de problemas.
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidEnvironmentError(
      `Variaveis de ambiente invalidas:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
