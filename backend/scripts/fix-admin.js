const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // "Abdulbosit" login='admin' — bu super admin profil yangilaganda yaratilgan yozuv
  // Uni to'g'ri "admin" qilib qoldiramiz va ism ni yangilaymiz
  
  const adminRecord = await p.employee.findUnique({ where: { login: 'admin' } });
  
  if (adminRecord) {
    // roleId ni olib tashlaymiz — super admin uchun role kerak emas
    // Yoki mavjud role biriktirib qo'yish mumkin
    console.log('Admin yozuvi topildi:', adminRecord.id, adminRecord.fullName);
    
    // Ismini "Abdulbosit" dan "Super Admin" ga qaytarish
    // Siz xohlagan ismga o'zgartiring
    await p.employee.update({
      where: { id: adminRecord.id },
      data: { 
        fullName: 'Abdulbosit',  // Siz kiritgan ism saqlanadi
        password: 'sharq2023'     // Parolni default ga qaytaramiz
      }
    });
    console.log('Admin yozuvi yangilandi');
  } else {
    console.log('Admin yozuvi topilmadi');
  }
  
  await p['$disconnect']();
}

main();
