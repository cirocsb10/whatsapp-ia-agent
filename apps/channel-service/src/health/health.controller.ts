import { Controller, Get } from "@nestjs/common";
import { getBuildInfo } from "../common/config/build-info";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    const { version, commit, buildDate } = getBuildInfo();
    return {
      status: "ok",
      service: "channel-service",
      version,
      commit,
      buildDate,
      timestamp: new Date().toISOString(),
    };
  }
}
