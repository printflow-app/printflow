import { PrismaClient } from '@prisma/client';
import { Telegraf } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';

// .env faylini qo'lda yuklash (dotenv kutubxonasi yo'qligi uchun)
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...val] = line.split('=');
      if (key && val.length > 0) {
        process.env[key.trim()] = val.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
} catch (err) {
  console.warn('⚠️ .env yuklashda muammo:', err.message);
}

const prisma = new PrismaClient();
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi.');
  process.exit(1);
}

const bot = new Telegraf(botToken);

async function run() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  console.log(`🚀 Davomat eslatmalari yuborilmoqda: ${todayStr}`);

  try {
    // 1. Barcha aktiv tenantlarni olish
    const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
    
    let sentCount = 0;
    let skipCount = 0;

    for (const tenant of tenants) {
      // 2. Telegrami ulangan barcha xodimlarni olish
      const employees = await prisma.employee.findMany({
        where: { tenantId: tenant.id, telegramId: { not: null } },
      });

      // 3. Bugungi davomat yozuvlarini olish
      const records = await prisma.attendanceRecord.findMany({
        where: { tenantId: tenant.id, date: todayStr },
      });

      for (const emp of employees) {
        if (!emp.telegramId) continue;

        const record = records.find(r => r.employeeId === emp.id);

        let message = '';
        if (!record || !record.checkIn) {
          // KELDIMni bosmaganlar
          message = `⚠️ *DIQQAT! Davomat eslatmasi*\n\nSiz bugun (${todayStr}) hali davomat qilmadingiz. Iltimos, ishga kelgan bo'lsangiz "Keldim" tugmasini bosing. Befarqlik qilmang!`;
        } else if (record.checkIn && !record.checkOut) {
          // KETDIMni bosmaganlar
          message = `👋 *Eslatma!*\n\nSiz bugun ishga kelgansiz, lekin hali "Ketdim" tugmasini bosmadingiz. Agar ishingiz tugagan bo'lsa, iltimos tugmani bosib qo'ying yoki ortiqcha ish qilgan bo'lsangiz izoh yozing.`;
        }

        if (message) {
          try {
            await bot.telegram.sendMessage(emp.telegramId, message, { parse_mode: 'Markdown' });
            sentCount++;
          } catch (err: any) {
            console.error(`❌ ${emp.fullName} ga xabar yuborilmadi: ${err.message}`);
            skipCount++;
          }
        }
      }
    }

    console.log(`✅ Tugatildi. Yuborildi: ${sentCount}, Xatolik: ${skipCount}`);
  } catch (error) {
    console.error('❌ Skriptda xatolik:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
