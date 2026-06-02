import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { isSuperAdmin?: boolean } | undefined;

    if (!user?.isSuperAdmin) {
      throw new ForbiddenException("Super-admin access required");
    }

    return true;
  }
}
