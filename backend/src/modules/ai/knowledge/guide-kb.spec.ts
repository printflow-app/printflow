import { decideKb } from './guide-kb';

// =============================================
// KB qaror qabul qilish testi.
//
// Bu matcher nozik: o'zbek lotinida apostroflar olib tashlangandan keyin
// "o'chirish" (delete) → "ochirish" bo'lib, "ochish" (open) bilan chalkashish
// xavfi bor. Noto'g'ri "qo'llanma javobi" — foydalanuvchiga xato yo'l-yo'riq
// bergani uchun LLM'ni bir marta chaqirishdan ancha yomon. Shuning uchun
// bu holatlar test bilan qotirilgan.
// =============================================

describe('decideKb', () => {
  describe("qo'llanmadan to'g'ridan-to'g'ri javob beriladigan savollar", () => {
    const cases: Array<[string, string]> = [
      ['xodim qayerdan qoshaman', 'xodim-qoshish'],
      ["xodim qanday qo'shaman?", 'xodim-qoshish'],
      ['Yangi hodimni qanday kiritaman', 'xodim-qoshish'],
      ['xodimni qanday tahrirlayman', 'xodim-tahrirlash'],
      ["xodim maoshini qayerdan o'zgartiraman", 'xodim-tahrirlash'],
      ['parolni qanday yangilayman', 'xodim-parol'],
      ['lavozim qanday yarataman', 'lavozim-yaratish'],
      ["buyurtma qanday qo'shaman", 'buyurtma-qoshish'],
      ['buyurtmani qayerdan ochaman', 'buyurtma-qoshish'],
      ["yangi xizmatni qanday qo'shaman", 'xizmat-qoshish'],
      ["narxlar ro'yxatini qayerdan ochaman", 'narx-royxati'],
      ['hisobotni qanday yuklab olaman', 'hisobot'],
      ["ombor materialini qanday qo'shaman", 'ombor'],
      ['davomatni qanday belgilayman', 'davomat'],
      ["filial qanday qo'shiladi", 'filial-bolim'],
      ['dashboard qanday ishlaydi', 'dashboard'],
      ['telegram botni qanday ulayman', 'telegram-bot'],
      ['AI limitim tugadi nima qilaman', 'ai-limit'],
      ['ai ni xodimga qanday yoqaman', 'ai-ruxsat'],
      ['ctrl k qanday ishlatiladi', 'tezkor-qidiruv'],

      // Maosh moduli
      ['maoshni qanday hisoblayman', 'maosh-hisob'],
      ["xodimga oylikni qayerdan to'layman", 'maosh-hisob'],
      ['maosh sxemasini qanday sozlayman', 'maosh-sxema'],
      ['kpi nimaga qarab hisoblanadi', 'maosh-metrika'],
      ['avansni qanday beraman', 'avans'],

      // Qolgan modullar
      ["hamkor qanday qo'shaman", 'hamkorlar'],
      ["ma'muriyat nima uchun kerak", 'mamuriyat'],
      ["statistikani qayerdan ko'raman", 'statistika'],
      ['buyurtmani qanday tahrirlayman', 'buyurtma-tahrirlash'],
      ["kanban ustunini qanday qo'shaman", 'kanban-ustun'],
      ['variant qanday kiritiladi', 'variant'],
      ['kassalar orasida pulni qanday otkazaman', 'kassa-boks'],
      ['material normasini qanday belgilayman', 'material-norma'],
      ['tarifni qanday uzaytiraman', 'tarif-tolov'],

      // Yaqin mavzular chalkashmasligi kerak (ilgari chalkashardi)
      ["xodim maoshini qayerdan o'zgartiraman", 'xodim-tahrirlash'],
      ['kassaga kirim qanday yozaman', 'kassa'],
      ['ai yordamchini qanday ochaman', 'ai-copilot'],
      ['AI limitim tugadi nima qilaman', 'ai-limit'],
    ];

    it.each(cases)('"%s" → %s', (question, expectedId) => {
      const d = decideKb(question);
      expect(d.kind).toBe('answer');
      if (d.kind === 'answer') expect(d.entry.id).toBe(expectedId);
    });
  });

  describe("o'chirish (delete) ochish (open) bilan chalkashmaydi", () => {
    const cases = [
      "buyurtmani qanday o'chiraman",
      "xizmatni qanday o'chiraman",
      "mijozni qanday o'chiraman",
      "narxlar ro'yxatini qanday o'chiraman",
    ];

    it.each(cases)('"%s" qo\'llanmadan javob olmaydi', (question) => {
      expect(decideKb(question).kind).not.toBe('answer');
    });
  });

  describe('dashboard "Bartaraf etish" so\'rovi qo\'llanmaga tushmaydi', () => {
    // Bu matnlarda "qanday" bor, lekin ular yo'l-yo'riq emas — jonli tahlil
    // va amal so'raladi. Ilgari bular xato ravishda qo'llanma javobini olardi.
    const cases = [
      "Xavf: Ish vaqti boshlandi, lekin 6 ta xodimdan birortasi ham davomat belgilamagan. Buni qanday hal qilishni maslahat bera olasizmi, kerak bo'lsa o'zing bajar.",
      "Xavf: 12 ta buyurtma muddati o'tgan. Buni qanday hal qilishni maslahat bera olasizmi, kerak bo'lsa o'zing bajar.",
      "Xavf: 5 ta material tugab qolyapti. Buni qanday hal qilishni maslahat bera olasizmi, kerak bo'lsa o'zing bajar.",
    ];

    it.each(cases)('"%s" qo\'llanmadan javob olmaydi', (question) => {
      expect(decideKb(question).kind).not.toBe('answer');
    });
  });

  describe("jonli ma'lumot va amallar LLM'ga o'tadi", () => {
    const cases = [
      'bugungi buyurtmalar qancha',
      "qarzdorlar ro'yxatini ber",
      'kassada qancha pul bor',
      'menga hisobot ber',
      '3000 ta vizitka buyurtma yaratib ber',
      'Akmalga buyurtma ochib ber',
      'nechta xodim bor',
      'omborda qancha material qoldi',
      "eng ko'p qarzi bor mijoz kim",
    ];

    it.each(cases)('"%s" qo\'llanmadan javob olmaydi', (question) => {
      expect(decideKb(question).kind).not.toBe('answer');
    });
  });

  describe("kontekstga bog'liq va begona savollar", () => {
    const cases = [
      "uni qanday o'zgartiraman",
      'buni qayerdan qilaman',
      'salom qalaysan',
      'ob-havo qanday',
    ];

    it.each(cases)('"%s" mos yozuv topmaydi', (question) => {
      expect(decideKb(question).kind).toBe('none');
    });
  });
});
