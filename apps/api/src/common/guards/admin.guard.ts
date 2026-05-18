import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user as { role?: string } | undefined;
    if (user?.role !== 'admin') throw new ForbiddenException('Admin access required');
    return true;
  }
}
