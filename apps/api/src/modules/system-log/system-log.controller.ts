import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { QuerySystemLogDto } from "./dto/query-system-log.dto";
import { SystemLogService } from "./system-log.service";

@Controller("super-admin/system-log")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SystemLogController {
  constructor(private readonly systemLog: SystemLogService) {}

  @Get()
  query(@Query() dto: QuerySystemLogDto) {
    return this.systemLog.query(dto);
  }
}
