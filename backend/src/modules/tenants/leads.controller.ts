import { Controller, Post, Get, Body, UseGuards, Param } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

@Controller('leads')
export class LeadsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post()
  async createLead(
    @Body()
    body: {
      firstName: string;
      lastName: string;
      companyName: string;
      role: string;
      phone: string;
      telegramUser?: string;
    },
  ) {
    const lead = await this.prisma.demoRequest.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        companyName: body.companyName,
        role: body.role,
        phone: body.phone,
        telegramUser: body.telegramUser,
      },
    });
    return { success: true, lead };
  }

  @UseGuards(SuperAdminGuard)
  @Get()
  async getLeads() {
    return this.prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(SuperAdminGuard)
  @Post(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.prisma.demoRequest.update({
      where: { id },
      data: { status: body.status },
    });
  }
}
