import {
  Controller, Get, Post, Param, Query, UseGuards, Headers, Body, HttpCode,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { OrdersService } from "./orders.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("orders")
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  findAll(
    @CurrentTenantId() tenantId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.findAll(tenantId, Number(page ?? 1), Number(limit ?? 20));
  }

  @Get(":id")
  @UseGuards(ClerkAuthGuard)
  findOne(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post("internal")
  @HttpCode(201)
  createInternal(
    @Headers("x-internal-token") token: string,
    @Body() body: any,
  ) {
    const expectedToken = process.env.INTERNAL_API_TOKEN;
    if (!expectedToken) {
      throw new Error("INTERNAL_API_TOKEN is not configured");
    }
    const tokenBuf = Buffer.from(token ?? "");
    const expectedBuf = Buffer.from(expectedToken);
    if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
      throw new UnauthorizedException("Unauthorized");
    }
    return this.service.createInternal(body);
  }
}
