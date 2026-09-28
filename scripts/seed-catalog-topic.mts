// Recria a massa de teste do topico catalog.ItemCreated usada pelo replay do
// ms-transport. Resultado esperado de um consumer novo com fromBeginning:
// 1 item no read model (BOX-001) e 3 mensagens na DLT.
//
//   offset 0: legado 0a923d7 (unitPrice string, sem schemaVersion/peso/dimensoes)
//   offset 1: legado 7e91b0a (unitPrice numero, sem schemaVersion/peso/dimensoes)
//   offset 2: mensagem invalida (nao e JSON)
//   offset 3: v1 valido BOX-001 (schemaVersion no payload), espelha a linha
//             08f321fe-... do outbox e o item b8a91f43-... do banco do catalog
//
// Aborta se o topico ja tiver mensagens, para nao duplicar a massa. O topico
// e criado (ou ajustado) com retention.ms=-1: a retencao padrao de 7 dias
// apagou a massa anterior.
//
// Uso: node --env-file=.env scripts/seed-catalog-topic.mts
// kafkajs e CommonJS: sob ESM so o default export e garantido.
import kafkajs from "kafkajs";

import { z } from "zod";

const { ConfigResourceTypes, Kafka, Partitioners, logLevel } = kafkajs;

const TOPIC = "catalog.ItemCreated";
const RETENTION_FOREVER = "-1";

const envSchema = z.object({
  KAFKA_BROKER: z.string().min(1).default("localhost:9092"),
});

const BOX_001_ID = "b8a91f43-8755-4815-bd61-bb3b15760af0";

const messages: ReadonlyArray<{ key: string; value: string }> = [
  {
    key: "5b0c3a52-0d6f-4c8e-9c1a-000000000001",
    value: JSON.stringify({
      eventType: "ItemCreated",
      aggregateId: "5b0c3a52-0d6f-4c8e-9c1a-000000000001",
      payload: {
        id: "5b0c3a52-0d6f-4c8e-9c1a-000000000001",
        sku: "LEGACY-001",
        name: "Item legado (unitPrice string)",
        unitPrice: "19.90",
      },
      occurredAt: "2026-08-25T12:00:00.000Z",
    }),
  },
  {
    key: "5b0c3a52-0d6f-4c8e-9c1a-000000000002",
    value: JSON.stringify({
      eventType: "ItemCreated",
      aggregateId: "5b0c3a52-0d6f-4c8e-9c1a-000000000002",
      payload: {
        id: "5b0c3a52-0d6f-4c8e-9c1a-000000000002",
        sku: "LEGACY-002",
        name: "Item legado (unitPrice numero)",
        unitPrice: 29.9,
      },
      occurredAt: "2026-09-01T12:00:00.000Z",
    }),
  },
  {
    key: "invalid-message",
    value: "t",
  },
  {
    key: BOX_001_ID,
    value: JSON.stringify({
      eventType: "ItemCreated",
      aggregateId: BOX_001_ID,
      payload: {
        schemaVersion: 1,
        id: BOX_001_ID,
        sku: "BOX-001",
        name: "Caixa Média",
        unitPrice: 24.9,
        weightKg: 0.75,
        dimensions: { lengthCm: 40, widthCm: 30, heightCm: 25 },
      },
      occurredAt: "2026-09-03T01:56:10.122Z",
    }),
  },
];

async function main(): Promise<void> {
  const env = envSchema.parse(process.env);
  const kafka = new Kafka({
    clientId: "ms-catalog-seed",
    brokers: [env.KAFKA_BROKER],
    logLevel: logLevel.WARN,
  });
  const admin = kafka.admin();
  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
  });

  await admin.connect();
  try {
    const existing = await admin.listTopics();
    if (existing.includes(TOPIC)) {
      const offsets = await admin.fetchTopicOffsets(TOPIC);
      const nonEmpty = offsets.some((p) => p.high !== p.low);
      if (nonEmpty) {
        throw new Error(
          `Topico ${TOPIC} ja tem mensagens; apague-o antes de rodar o seed`,
        );
      }
      await admin.alterConfigs({
        validateOnly: false,
        resources: [
          {
            type: ConfigResourceTypes.TOPIC,
            name: TOPIC,
            configEntries: [{ name: "retention.ms", value: RETENTION_FOREVER }],
          },
        ],
      });
    } else {
      await admin.createTopics({
        waitForLeaders: true,
        topics: [
          {
            topic: TOPIC,
            numPartitions: 1,
            configEntries: [{ name: "retention.ms", value: RETENTION_FOREVER }],
          },
        ],
      });
    }

    await producer.connect();
    try {
      // Uma mensagem por send para fixar a ordem dos offsets.
      for (const message of messages) {
        await producer.send({ topic: TOPIC, messages: [message] });
      }
    } finally {
      await producer.disconnect();
    }

    process.stdout.write(`Seed concluido: ${messages.length} mensagens em ${TOPIC}\n`);
  } finally {
    await admin.disconnect();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Seed falhou: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
});
