# ms-catalog

Microsserviço de catálogo de itens, construído com NestJS e Prisma.

## O que este serviço faz

Expõe endpoints HTTP para cadastro e consulta de itens do catálogo:

- `POST /items` — cria um novo item.
- `GET /items` — lista os itens cadastrados (aceita `page` e `limit` como query params opcionais).
- `GET /items/:id` — busca um item específico pelo id.

## Stack

- NestJS + TypeScript
- Prisma (PostgreSQL)
- Pino para logs estruturados

## Rodando localmente

```bash
yarn install
yarn start:dev
```

As variáveis de ambiente necessárias estão descritas em `.env` (não versionado).

## Integração entre microsserviços

Este é o **primeiro microsserviço** criado no projeto. Ainda não há outro
microsserviço consumindo o `ms-catalog`. Quando um segundo microsserviço
precisar chamar este serviço (via HTTP ou Kafka), a forma de integração
(endpoints expostos, eventos publicados, contratos de payload) deve ser
documentada aqui.
