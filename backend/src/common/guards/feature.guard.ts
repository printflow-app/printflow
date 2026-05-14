import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRE_FEATURE_KEY } from '../decorators/feature.decorator';
import { TenantContext } from '../tenant/tenant.context';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeature) {
      return true;
    }

    // Since this runs before Interceptors but after JwtAuthGuard, we get tenantId from req
    const req = context.switchToHttp().getRequest();
    const tenantId = req._tenantPayload?.tenantId;
    
    if (!tenantId) {
      return true; // If no tenant ID context, maybe it's super-admin or public
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true }
    });

    if (!tenant || !tenant.plan) {
      // If no plan is assigned, allow basic access or block? We'll assume if no plan, no premium features.
      throw new ForbiddenException(`FEATURE_DISABLED: Sizning ta'rifingizda '${requiredFeature}' imkoniyati yo'q`);
    }

    // Source of truth — `allowedModules` array (admin panel saves here).
    // Legacy `features` JSON object is checked as fallback for old plans.
    const allowedModules: string[] = Array.isArray((tenant.plan as any).allowedModules)
      ? (tenant.plan as any).allowedModules
      : [];

    let features: Record<string, any> = {};
    try { features = JSON.parse(tenant.plan.features); } catch (e) {}

    // Map legacy/short keys → canonical admin-panel module keys, so a controller
    // marked @RequireFeature('attendance') matches both 'attendance' and any aliases.
    const aliases: Record<string, string[]> = {
      attendance:  ['attendance', 'canViewAttendance'],
      finance:     ['finance', 'canViewFinance'],
      kanban:      ['kanban', 'tasks'],
      inventory:   ['inventory', 'warehouse', 'canViewInventory'],
      reports:     ['reports', 'kpi', 'kpiTracking'],
      customers:   ['customers', 'debtors'],
      ai_chat:     ['ai_chat', 'telegram_bot', 'advancedBot'],
      partners:    ['partners'],
      branches:    ['branches', 'multiBranch', 'multi_branch'],
      statistics:  ['statistics'],
      employees:   ['employees'],
    };
    const keysToCheck = aliases[requiredFeature] || [requiredFeature];

    const allowedByModules = keysToCheck.some(k => allowedModules.includes(k));
    const allowedByFeatures = keysToCheck.some(k => {
      const v = features[k];
      return v !== false && v !== undefined && v !== null && v !== '';
    });

    if (!allowedByModules && !allowedByFeatures) {
      throw new ForbiddenException(`FEATURE_DISABLED: Sizning ta'rifingizda '${requiredFeature}' imkoniyati yo'q`);
    }

    return true;
  }
}
