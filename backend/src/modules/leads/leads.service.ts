import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: {
    firstName: string;
    lastName: string;
    companyName: string;
    role: string;
    phone: string;
    telegramUser?: string;
  }) {
    return this.prisma.demoRequest.create({
      data,
    });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.demoRequest.update({
      where: { id },
      data: { status },
    });
  }

  remove(id: string) {
    return this.prisma.demoRequest.delete({
      where: { id },
    });
  }
}
