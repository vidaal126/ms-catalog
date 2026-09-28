import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "@common/logger/logger.module";
import { type Env, readEnv, validateEnv } from "@config/env";
import { MetricsModule } from "@infrastructure/metrics/metrics.module";
import { PrismaModule } from "@infrastructure/database/prisma/prisma.module";
import { HealthModule } from "@infrastructure/health/health.module";
import { GlobalExceptionFilter } from "@infrastructure/http/filters/global-exception.filter";
import { ItemModule } from "@infrastructure/item.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            name: "default",
            ttl: readEnv(config, "THROTTLE_DEFAULT_TTL_MS"),
            limit: readEnv(config, "THROTTLE_DEFAULT_LIMIT"),
          },
          {
            name: "createItem",
            ttl: readEnv(config, "THROTTLE_CREATE_ITEM_TTL_MS"),
            limit: readEnv(config, "THROTTLE_CREATE_ITEM_LIMIT"),
          },
        ],
      }),
    }),
    MetricsModule,
    PrismaModule,
    HealthModule,
    ItemModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
