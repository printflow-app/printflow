import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
export declare class TelegramService implements OnModuleInit, OnModuleDestroy {
    private prisma;
    private bot;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    private initializeBot;
    sendMessage(telegramId: string, text: string): Promise<void>;
    sendNotification(employeeId: string, message: string): Promise<void>;
    notifyAdmins(message: string): Promise<void>;
    private generateReportForTenant;
    private checkInactiveTasks;
    handleDailyReport(): Promise<void>;
    handleHourlyTaskCheck(): Promise<void>;
}
