import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "@common/logger/logger.module";
import { PrismaModule } from "@infrastructure/database/prisma/prisma.module";
import { GlobalExceptionFilter } from "@infrastructure/http/filters/global-exception.filter";
import { ItemModule } from "@infrastructure/item.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    PrismaModule,
    ItemModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
})
export class AppModule {}
