import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { PlatformSettingsModule } from "../platform-settings/platform-settings.module";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";

@Module({
  imports: [PrismaModule, PlatformSettingsModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
