import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "@common/logger/logger.module";
import { type Env, validateEnv } from "@config/env";
import { PrismaModule } from "@infrastructure/database/prisma/prisma.module";
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
            ttl: config.get("THROTTLE_DEFAULT_TTL_MS", { infer: true }),
            limit: config.get("THROTTLE_DEFAULT_LIMIT", { infer: true }),
          },
          {
            name: "createItem",
            ttl: config.get("THROTTLE_CREATE_ITEM_TTL_MS", { infer: true }),
            limit: config.get("THROTTLE_CREATE_ITEM_LIMIT", { infer: true }),
          },
        ],
      }),
    }),
    PrismaModule,
    ItemModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
