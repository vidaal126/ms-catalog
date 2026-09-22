import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import {
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
} from "@nestjs/terminus";
import { KafkaHealthIndicator } from "@infrastructure/messaging/kafka.health";
import { PrismaHealthIndicator } from "./prisma.health";

@Controller("health")
@SkipThrottle({ default: true, createItem: true })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly kafka: KafkaHealthIndicator,
  ) {}

  // Liveness: o processo responde. Nao checa dependencias, para que uma
  // queda do banco/broker nao provoque restart em cascata.
  @Get("live")
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  // Readiness: pode receber trafego (banco e Kafka acessiveis).
  @Get("ready")
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.isHealthy("database"),
      () => this.kafka.isHealthy("kafka"),
    ]);
  }
}
