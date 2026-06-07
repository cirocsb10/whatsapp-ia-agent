import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { CrmProgressionService } from "./crm-progression.service";

@Module({
  controllers: [CrmController],
  providers: [CrmService, CrmProgressionService],
  exports: [CrmService, CrmProgressionService],
})
export class CrmModule {}
