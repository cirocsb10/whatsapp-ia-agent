import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentTenantId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.tenantId as string;
  },
);
