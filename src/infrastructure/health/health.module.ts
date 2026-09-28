import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { MessagingModule } from "@infrastructure/messaging/messaging.module";
import { HealthController } from "./health.controller";
import { PrismaHealthIndicator } from "./prisma.health";

@Module({
  imports: [TerminusModule, MessagingModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
