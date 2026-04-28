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

    let features = {};
    try {
      features = JSON.parse(tenant.plan.features);
    } catch (e) {}

    // Some features might be "view_only" or "basic". Here we check truthiness or explicit flags
    const featureVal = features[requiredFeature];
    if (featureVal === false || featureVal === undefined || featureVal === null || featureVal === '') {
      throw new ForbiddenException(`FEATURE_DISABLED: Sizning ta'rifingizda '${requiredFeature}' imkoniyati yo'q`);
    }

    return true;
  }
}
