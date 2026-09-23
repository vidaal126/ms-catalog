# ms-catalog

Microsserviço de catálogo de itens (NestJS, Prisma, PostgreSQL, Kafka). É o
produtor do evento `ItemCreated`, consumido pelo `ms-transport` para montar o
read model de itens.

## Arquitetura

Camadas hexagonais, com dependências apontando para dentro:

- `src/domain`: entidade `ItemEntity` (registra o evento de domínio
  `ItemCreated`), value object `Dimensions` e hierarquia de erros de domínio.
  Não depende de Nest, Prisma nem Kafka.
- `src/application`: use cases (`CreateItem`, `GetItem`, `ListItems`) e ports
  (`IdGenerator`).
- `src/infrastructure`: HTTP (controller, DTOs, filtro global de exceções,
  Idempotency-Key), Prisma (repositório e outbox), messaging (`MessagingModule`)
  e health checks.

Publicação via **Transactional Outbox**: o item e o registro do evento são
gravados na mesma transação; o `OutboxPublisherService` lê o outbox e publica
no Kafka, marcando como publicado só depois do envio (at-least-once).

## Como subir

### Tudo em container

O `docker-compose.yml` deste repositório sobe os dois serviços (o
`ms-transport` é buildado a partir de `../ms-transport`) e toda a
infraestrutura:

```bash
docker compose up -d --build
```

| Serviço | Endereço no host |
|---|---|
| ms-catalog | http://localhost:3000 (`CATALOG_PORT`) |
| ms-transport | http://localhost:3001 (`TRANSPORT_PORT`) |
| Kafka | localhost:9092 |
| Kafka UI | http://localhost:8090 |
| Postgres catálogo | localhost:5433 |
| Postgres transporte | localhost:5435 |
| RabbitMQ | localhost:5672 (painel em http://localhost:15672) |

Os jobs `catalog-migrate` e `transport-migrate` aplicam as migrations antes de
cada app subir; `kafka-init` cria `catalog.ItemCreated` e
`catalog.ItemCreated.DLT` com retenção infinita.

Não suba junto com o `docker-compose.yml` do próprio `ms-transport`: as portas
do Postgres e do RabbitMQ são as mesmas.

### Apps no host, infraestrutura em container

```bash
docker compose up -d catalog-db transport-db kafka kafka-init rabbitmq kafka-ui
cp .env.example .env
corepack yarn@1.22.22 install
npx prisma migrate deploy
corepack yarn@1.22.22 start
```

O Kafka tem dois listeners: containers usam `kafka:29092` (o compose já
configura) e apps no host usam `localhost:9092` (o `.env`).

O projeto usa Yarn 1 (`yarn.lock` v1). Se o `yarn` global for o Yarn 4, use
`corepack yarn@1.22.22`: o Yarn 4 converte o projeto para PnP e esvazia o
`node_modules`.

## Variáveis de ambiente

Validadas com Zod no bootstrap: a aplicação não sobe com env inválida e lista
todas as variáveis com problema.

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | obrigatória | URL `postgresql://` |
| `KAFKA_BROKER` | obrigatória | lista `host:porta` separada por vírgula |
| `NODE_ENV` | `development` | `production` desliga o pino-pretty |
| `PORT` | `3000` | porta HTTP (8080 na imagem Docker) |
| `LOG_LEVEL` | `info` | nível do Pino |
| `KAFKA_CLIENT_ID` | `ms-catalog` | client id do KafkaJS |
| `OUTBOX_POLL_INTERVAL_MS` | `2000` | intervalo do polling do outbox |
| `OUTBOX_BATCH_SIZE` | `20` | eventos por ciclo |
| `THROTTLE_DEFAULT_TTL_MS` / `THROTTLE_DEFAULT_LIMIT` | `60000` / `100` | rate limit de todas as rotas |
| `THROTTLE_CREATE_ITEM_TTL_MS` / `THROTTLE_CREATE_ITEM_LIMIT` | `60000` / `20` | rate limit do `POST /items` |
| `IDEMPOTENCY_TTL_HOURS` | `24` | validade de uma Idempotency-Key |
| `IDEMPOTENCY_LOCK_TIMEOUT_MS` | `30000` | depois disso uma chave "em andamento" pode ser assumida |
| `IDEMPOTENCY_CLEANUP_INTERVAL_MS` | `3600000` | limpeza de chaves expiradas |
| `HEALTH_CHECK_TIMEOUT_MS` | `1500` | timeout de cada checagem do readiness |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | teto do graceful shutdown |

## API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/items` | cria item. Aceita `X-Correlation-Id` e `Idempotency-Key` |
| `GET` | `/items?page=&limit=` | lista paginada `{ items, total, page, pageSize }` |
| `GET` | `/items/:id` | busca por id |
| `GET` | `/health/live` | liveness (não checa dependências) |
| `GET` | `/health/ready` | readiness (banco e Kafka) |

Erros de domínio viram 404 (não encontrado), 409 (SKU duplicado) e 422
(invariante violada); validação de entrada é 400; erro inesperado é 500 sem
detalhes (o detalhe fica no log).

**Idempotency-Key** (opcional no `POST /items`): mesma chave e mesmo corpo
devolvem a resposta original com `Idempotent-Replayed: true`; corpo diferente
retorna 422; requisição concorrente com a mesma chave retorna 409. Só
respostas de sucesso são guardadas.

**X-Correlation-Id**: aceito se tiver até 128 caracteres `[A-Za-z0-9._:-]`,
senão é gerado. Volta no header da resposta, aparece em todos os logs da
requisição e vai para o envelope do evento.

## Evento publicado

Tópico `catalog.ItemCreated`, key = `aggregateId` (ordem por item), headers
`eventType`, `schemaVersion` e `correlationId`:

```json
{
  "eventId": "uuid (id da linha do outbox, estável entre reenvios)",
  "eventType": "ItemCreated",
  "schemaVersion": 2,
  "occurredAt": "ISO-8601",
  "aggregateId": "id do item",
  "correlationId": "...",
  "payload": {
    "id": "...", "sku": "...", "name": "...", "unitPrice": 24.9,
    "weightKg": 0.75,
    "dimensions": { "lengthCm": 40, "widthCm": 30, "heightCm": 25 }
  }
}
```

Eventos antigos (v1) tinham `schemaVersion: 1` dentro do payload e nenhum
envelope com `eventId`; o `ms-transport` aceita os dois formatos.

### Massa de teste do tópico

```bash
corepack yarn@1.22.22 seed:topic
```

Publica 2 eventos legados, 1 mensagem inválida e o BOX-001 em v1 (replay
esperado no `ms-transport`: 1 item e 3 mensagens na DLT). Aborta se o tópico já
tiver mensagens; para recriar:

```bash
docker exec catalog-kafka kafka-topics --bootstrap-server localhost:29092 --delete --topic catalog.ItemCreated
corepack yarn@1.22.22 seed:topic
```

### Inspecionar a DLT

A DLT é do `ms-transport` (`catalog.ItemCreated.DLT`). Pela Kafka UI
(http://localhost:8090) ou:

```bash
docker exec catalog-kafka kafka-console-consumer --bootstrap-server localhost:29092 \
  --topic catalog.ItemCreated.DLT --from-beginning --property print.headers=true
```

## Testes

```bash
corepack yarn@1.22.22 test              # unitários
corepack yarn@1.22.22 test:integration  # Postgres e Kafka reais (testcontainers)
corepack yarn@1.22.22 test:e2e          # catálogo -> Kafka -> read model do ms-transport
```

Integração e e2e precisam de Docker. O e2e builda as imagens do `ms-transport`
a partir de `../ms-transport` (ou `TRANSPORT_CONTEXT`); a primeira execução
leva cerca de 10 minutos por causa do build.

## Limitações conhecidas

- **Entrega at-least-once**: se o processo cair entre publicar no Kafka e
  marcar o evento no outbox, ele é reenviado. O `eventId` é estável para o
  consumidor deduplicar.
- **Várias réplicas** leriam os mesmos eventos pendentes do outbox e
  publicariam em duplicidade (não há lock por linha). Seguro para o consumidor
  idempotente, mas desperdiça envio.
- **Idempotency-Key**: se o processo cair depois de criar o item e antes de
  gravar a resposta, uma nova tentativa (após o lock vencer) recebe 409 de SKU
  duplicado em vez do 201 original.
- **Rate limit em memória**: vale por réplica; atrás de proxy é preciso
  configurar `trust proxy`.
- **Readiness depende do Kafka**: com o broker fora a API ainda aceitaria
  criações (o outbox acumula), mas o readiness fica 503.
