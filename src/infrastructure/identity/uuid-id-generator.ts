import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { IdGenerator } from "@application/ports/id-generator.port";

@Injectable()
export class UuidIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
