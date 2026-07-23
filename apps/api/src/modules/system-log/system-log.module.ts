import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { SystemLogController } from "./system-log.controller";
import { SystemLogInterceptor } from "./system-log.interceptor";
import { SystemLogService } from "./system-log.service";

@Module({
  imports: [PrismaModule],
  controllers: [SystemLogController],
  providers: [
    SystemLogService,
    { provide: APP_INTERCEPTOR, useClass: SystemLogInterceptor },
  ],
  exports: [SystemLogService],
})
export class SystemLogModule {}
