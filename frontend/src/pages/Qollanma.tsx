import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search, Book, ChevronRight, ChevronLeft, ChevronDown, Menu, X,
  PlayCircle, LayoutTemplate, Layers, Users, CreditCard,
  Building2, ShieldCheck, BarChart3, QrCode, Bot, Command, Sparkles, Send, FileText, Wallet, Calculator,
  Info, AlertTriangle, Lightbulb, ClipboardList, Target,
} from 'lucide-react';
import { EmptyState } from '../components/ui';

// =============================================
// Qollanma — Notion uslubidagi yordam markazi
//
// Struktura: GUIDES[].sections[].blocks[] — har guide kichik bo'limlarga ajratilgan
// shunda TOC, deep-link, va search highlight ishlay oladi. JSXdagi har xil rangli
// kartochkalar o'rniga 3 ta callout toni (info / tip / warn) ishlatamiz —
// orange aksent ortidan toza oq fon.
// =============================================

type Block =
  | { type: 'p'; html: string }
  | { type: 'steps'; items: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'callout'; tone: 'info' | 'tip' | 'warn'; title?: string; html: string }
  | { type: 'kbd'; combo: string[]; note?: string }
  | { type: 'code'; rows: { cmd: string; desc: string }[] };

type Section = { id: string; title: string; blocks: Block[] };

type Guide = {
  id: string;
  category: string;
  icon: React.ReactNode;
  title: string;
  tags: string[];
  intro: string;
  sections: Section[];
};

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'boshlanish', label: 'Boshlanish' },
  { id: 'buyurtmalar', label: 'Buyurtmalar va Xizmatlar' },
  { id: 'xodimlar', label: 'Xodim boshqaruvi' },
  { id: 'moliya', label: 'Moliya va Hisobot' },
  { id: 'tashkilot', label: 'Tashkilot' },
  { id: 'yordamchilar', label: 'Yordamchilar' },
];

const GUIDES: Guide[] = [
  {
    id: 'jamoa-vazifalari',
    category: 'buyurtmalar',
    icon: <ClipboardList size={16} />,
    title: 'Jamoa vazifalari doskasi',
    tags: ['vazifa', 'topshiriq', 'doska', 'jamoa', 'band', 'operatsion'],
    intro: "Buyurtma kanbani \"buyurtma qaysi bosqichda?\" degan savolga javob beradi. Bu doska boshqa savolga: \"qaysi xodim hozir nima bilan band?\". Unda buyurtmalar ham, operatsion vazifalar ham birga ko'rinadi.",
    sections: [
      { id: 'jv-ustunlar', title: 'Uchta bosqich', blocks: [
        { type: 'list', items: ['Qilinishi kerak — hali boshlanmagan ishlar', 'Jarayonda — hozir bajarilayotgani', 'Bajarilgan — tugaganlari'] },
        { type: 'p', html: "Buyurtmalar bu bosqichlarga Kanbandagi ustuniga qarab AVTOMATIK joylashadi: birinchi ustun — reja, \"bajarildi\" belgili ustun — bajarilgan, oradagilari — jarayonda." },
      ] },
      { id: 'jv-yaratish', title: 'Vazifa yaratish', blocks: [
        { type: 'p', html: "\"+ Vazifa\" tugmasi. To'rtta maydon yetarli: sarlavha, izoh, kim qilishi kerak, muddat." },
        { type: 'p', html: "Mas'ul tanlansa unga Telegram orqali xabar boradi. Telegram ishlamasa ham vazifa saqlanadi." },
        { type: 'p', html: "Misol: \"Qarzdorlar bilan ishlash\" — bu buyurtma emas, lekin kimdir bajarishi kerak va rahbar uni ko'rib turishi kerak." },
      ] },
      { id: 'jv-kochirish', title: "Bosqichni o'zgartirish", blocks: [
        { type: 'p', html: "Vazifani sudrab boshqa ustunga tashlang. Sudrash qiyin bo'lsa, karta ustiga borganda chiqadigan \"→ Jarayonda\" tugmalaridan foydalaning." },
        { type: 'callout', tone: 'warn', html: "Buyurtmani bu doskada ko'chirib bo'lmaydi — uni \"Xizmatlar (Kanban)\" sahifasida ko'chiring. Aks holda bitta buyurtma ikki joyda ikki xil bosqichda ko'rinib qolardi." },
      ] },
      { id: 'jv-ruxsat', title: 'Ruxsatlar', blocks: [
        { type: 'list', items: ["Jamoa vazifalari doskasiga kirish — menyuda bo'lim ko'rinadi", "Jamoa vazifasini yaratish va ko'chirish — tugma va sudrash ishlaydi"] },
        { type: 'p', html: "Ikkalasi Sozlamalar → Rollar bo'limida beriladi. Sukut bo'yicha o'chiq." },
      ] },
    ],
  },
  {
    id: 'zararsizlik-nuqtasi',
    category: 'moliya',
    icon: <Target size={16} />,
    title: 'Zararsizlik nuqtasi (break-even)',
    tags: ['break-even', 'zararsizlik', 'nol', 'foyda', 'xarajat'],
    intro: "Bitta savolga javob beradi: shu oy zararsiz chiqish uchun yana qancha ish kerak? Hisobotlar sahifasida.",
    sections: [
      { id: 'be-hisob', title: 'Qanday hisoblanadi', blocks: [
        { type: 'p', html: "Hech narsa taxmin qilinmaydi — hammasi xarajat tarixingizdan o'lchanadi." },
        { type: 'list', items: ["Doimiy xarajat — deyarli har oy takrorlanadigani (maosh, ijara, kommunal)", "Vaqti-vaqti bilan — 3-4 oyda yoki yiliga bir marta bo'ladigani (jihoz ta'miri)"] },
        { type: 'p', html: "Vaqti-vaqti bilan bo'ladigan xarajat ham oyga taqsimlanadi. Aks holda u chiqqan oyda zarar, qolgan oylarda soxta foyda ko'rinardi." },
      ] },
      { id: 'be-progress', title: 'Progress bar', blocks: [
        { type: 'p', html: "Bar to'lganda shu oygi xarajat qoplangan — undan keyingi har so'm sof foyda." },
        { type: 'p', html: "Pastda qolgan summa nechta ishga tengligi ko'rsatiladi: \"yana 12 ta vizitka\" degan javob raqamdan tushunarliroq." },
        { type: 'callout', tone: 'warn', html: "Tarix 2 oydan kam bo'lsa karta buni ochiq aytadi — raqamlar taxminiy." },
      ] },
    ],
  },
  {
    id: 'xodim-bolimlari',
    category: 'xodimlar',
    icon: <Layers size={16} />,
    title: "Xodimni bo'limga biriktirish",
    tags: ['bolim', 'department', 'maosh', 'poligrafiya', 'reklama'],
    intro: "Kompaniyada bir nechta bo'lim bo'lsa, har bir xodim qaysi bo'lim(lar)da ishlashini belgilash mumkin. Bu maoshga bevosita ta'sir qiladi.",
    sections: [
      { id: 'xb-tanlash', title: 'Qanday belgilanadi', blocks: [
        { type: 'p', html: "Xodimlar → xodimni tahrirlash → Bo'limlar. Bir nechta tanlash mumkin: bitta odam ham poligrafiyaga, ham tashqi reklamaga ishlashi mumkin." },
        { type: 'p', html: "Bo'lim tanlanmasa, xodim barcha bo'limlar bo'yicha hisoblanadi — avvalgidek." },
      ] },
      { id: 'xb-maosh', title: "Maoshga ta'siri", blocks: [
        { type: 'p', html: "Bo'lim biriktirilgan bo'lsa, KPI ko'rsatkichlari faqat O'SHA bo'lim buyurtma va tushumidan hisoblanadi. Poligrafiyachi tashqi reklama pulidan hisob olmaydi." },
        { type: 'p', html: "Bo'limi ko'rsatilmagan eski buyurtmalar hammaga hisoblanadi — odamning haqini olib qo'ymaslik uchun." },
      ] },
    ],
  },
  {
    id: 'onboarding-tour',
    category: 'boshlanish',
    icon: <Sparkles size={16} />,
    title: 'Interaktiv tour',
    tags: ['onboarding', 'tour', 'tutorial', 'qollanma', 'boshlash'],
    intro: 'Yangi register qilgan foydalanuvchi uchun bosqichma-bosqich tour. O\'yin uslubidagi spotlight + tooltip, mijoz o\'zi tugmalarni bosib o\'tadi.',
    sections: [
      {
        id: 'tour-tartibi', title: 'Tour qadamlari',
        blocks: [
          { type: 'list', items: [
            'Welcome — xush kelibsiz ekrani',
            '1. Filial sozlash (Ma\'muriyat → Filiallar)',
            '2. Lavozim yaratish (Sozlamalar)',
            '3. To\'lov turlari',
            '4. Xizmatlar katalogi',
            '5. Birinchi xodim',
            '6. Kanban ustunlari',
            'Done — biznesni boshqarish mumkin',
          ]},
        ],
      },
      {
        id: 'tour-qayta', title: 'Qaytadan ishga tushirish',
        blocks: [
          { type: 'callout', tone: 'tip', title: 'Maslahat',
            html: 'Ushbu sahifa chap panelida <strong>"Yo\'l-yo\'riqni qaytadan ko\'rish"</strong> tugmasini bosing — tour qaytadan boshlanadi.' },
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    category: 'boshlanish',
    icon: <LayoutTemplate size={16} />,
    title: 'Dashboard',
    tags: ['dashboard', 'bosh sahifa', 'widget', 'vidjet', 'chart', 'grafik', 'umumiy'],
    intro: "Butun tizimning bir ekrandagi manzarasi — moliya, buyurtmalar, davomat, mijozlar, ombor, hamkorlar va xodimlar bo'yicha kartalar hamda grafiklar.",
    sections: [
      {
        id: 'nima-bor', title: 'Qanday kartalar bor',
        blocks: [
          { type: 'list', items: [
            "<strong>AI xavf nazorati</strong> — tizim topgan muammolar (eng yuqorida)",
            "<strong>Moliya</strong> — bugungi va 30 kunlik kirim/chiqim, 14 kunlik trend grafigi, to'lov turlari kesimi",
            "<strong>Buyurtmalar</strong> — umumiy soni, muddati o'tganlari va Kanban ustunlari bo'yicha taqsimot",
            "<strong>Davomat</strong> — bugun kelganlar foizi va 7 kunlik trend",
            "<strong>Mijozlar</strong> — eng katta qarzdor 5 ta mijoz",
            "<strong>Ombor</strong> — minimal chegaradan pastga tushgan materiallar",
            "<strong>Hamkorlar</strong> — vendorlar bo'yicha balans holati",
            "<strong>Xodimlar</strong> — lavozimlar bo'yicha taqsimot",
          ]},
        ],
      },
      {
        id: 'sozlash', title: 'Kartalarni sozlash',
        blocks: [
          { type: 'steps', items: [
            "O'ng yuqoridagi <strong>sozlash</strong> tugmasini bosing",
            "Kerak bo'lmagan kartalarni belgisini olib tashlang",
            "Tanlov shu brauzerda saqlanadi — keyingi kirishda ham o'sha holatda ochiladi",
          ]},
          { type: 'callout', tone: 'info', title: 'Ruxsatlar',
            html: 'Har karta o\'z ruxsatini mustaqil tekshiradi. Masalan moliyani ko\'rish huquqi yo\'q xodimga moliya kartasi umuman ko\'rinmaydi — sozlamada ham chiqmaydi.' },
        ],
      },
    ],
  },
  {
    id: 'command-palette',
    category: 'boshlanish',
    icon: <Command size={16} />,
    title: 'Tezkor qidiruv (Ctrl+K)',
    tags: ['ctrl', 'k', 'qidiruv', 'navigatsiya', 'command'],
    intro: 'Klaviatura orqali istalgan sahifaga 2 ta bosish bilan o\'tish.',
    sections: [
      {
        id: 'kombinatsiya', title: 'Kombinatsiya',
        blocks: [
          { type: 'kbd', combo: ['Ctrl', 'K'], note: 'Mac\'da ⌘ + K' },
        ],
      },
      {
        id: 'ishlatish', title: 'Ishlatish',
        blocks: [
          { type: 'steps', items: [
            'Istalgan sahifada <strong>Ctrl + K</strong> bosing',
            'Sahifa nomini yozing: <em>kassa</em>, <em>buyurtma</em>, <em>hodim</em>',
            '↑↓ klavishlari bilan tanlang',
            '<strong>Enter</strong> — o\'tasiz, <strong>Esc</strong> — yopiladi',
          ]},
        ],
      },
    ],
  },

  {
    id: 'buyurtma-qoshish',
    category: 'buyurtmalar',
    icon: <LayoutTemplate size={16} />,
    title: 'Yangi buyurtma qo\'shish',
    tags: ['buyurtma', 'task', 'yangi', 'qoshish', 'zakaz', 'kanban'],
    intro: 'Mijozdan tushgan yangi buyurtmalarni tizimga kiritish va Kanban doskasiga joylash.',
    sections: [
      {
        id: 'qadamlar', title: 'Qadam-baqadam',
        blocks: [
          { type: 'steps', items: [
            'Chap menyudan <strong>Xizmatlar (Kanban)</strong> bo\'limiga kiring',
            'O\'ng yuqori burchakda <strong>+ Yangi Buyurtma</strong> tugmasini bosing',
            'Buyurtma nomi va mijozni tanlang (yoki yangi mijoz ismini kiriting)',
            '<strong>Xizmat turi:</strong> qaysi xizmat qilinishini ro\'yxatdan tanlang',
            '<strong>Opsiyalar:</strong> qog\'oz qalinligi, rang — narx avtomat o\'zgaradi',
            '<strong>Moliya:</strong> buyurtma narxi va oldindan to\'lov (zakolat)',
            '<strong>Saqlash</strong> — buyurtma birinchi bosqichga qo\'shiladi',
          ]},
        ],
      },
    ],
  },
  {
    id: 'xizmat-qoshish',
    category: 'buyurtmalar',
    icon: <Layers size={16} />,
    title: 'Xizmatlar katalogi (Pricing Engine)',
    tags: ['xizmat', 'katalog', 'qoshish', 'narx', 'mahsulot', 'opsiya', 'pricing'],
    intro: 'Yangi xizmat turi, opsiyalar bilan moslashuvchan narxlar va material normalari (BOM).',
    sections: [
      {
        id: 'tartib', title: 'Xizmat qo\'shish tartibi',
        blocks: [
          { type: 'steps', items: [
            'Chap menyuda <strong>Operatsiya → Xizmatlar katalogi</strong> tabini oching',
            'O\'ng yuqori burchakda <strong>+ Yangi Xizmat</strong> tugmasini bosing',
            'Nomi (<em>Vizitka</em>, <em>Banner</em>), birlik (dona, m², metr) va asosiy narxni kiriting',
            'Yaratgandan so\'ng xizmat kartasini ochib <strong>Opsiyalar</strong> qo\'shing — har biri bazaviy narxga foiz qo\'shadi',
            '<strong>Material normasi (BOM):</strong> 1 dona uchun qancha material sarflanishi — omborda avtomatik band qilinadi',
          ]},
        ],
      },
      {
        id: 'isolation', title: 'Filiallar va izolatsiya',
        blocks: [
          { type: 'callout', tone: 'warn', title: 'Strict isolation',
            html: 'Har xizmat ma\'lum filialga tegishli. Bir filial xizmati boshqa filialda ko\'rinmaydi. Boshqasiga ko\'chirish uchun <strong>Clone</strong> tugmasini bosing.' },
        ],
      },
    ],
  },

  {
    id: 'narx-royxati',
    category: 'buyurtmalar',
    icon: <FileText size={16} />,
    title: "Narxlar ro'yxati va buyurtma taklifi",
    tags: ['narx', 'royxat', 'pricelist', 'taklif', 'kommercheskiy', 'pdf', 'qidiruv'],
    intro: "Mijozga yuboriladigan narxlar varag'i va tayyor buyurtma taklifi (quote) — PDF yoki PNG ko'rinishida.",
    sections: [
      {
        id: 'ochish', title: 'Qayerdan ochiladi',
        blocks: [
          { type: 'steps', items: [
            "<strong>Sozlamalar</strong> sahifasini oching",
            "<strong>Narxlar ro'yxati</strong> bo'limidagi tugmani bosing",
            "Yuqoridagi ikkita rejimdan birini tanlang: <strong>Narxlar varag'i</strong> yoki <strong>Buyurtma taklifi</strong>",
          ]},
        ],
      },
      {
        id: 'taklif', title: 'Buyurtma taklifini tuzish',
        blocks: [
          { type: 'steps', items: [
            "Yuqoridagi <strong>qidiruv maydoniga</strong> mahsulot nomini yozing — ro'yxat darhol filtrlanadi (xizmat nomi, o'lchov birligi va opsiya qiymatlari bo'yicha qidiradi)",
            "Kerakli opsiyalarni tanlang — dona narxi jonli o'zgaradi",
            "Sonini kiriting va <strong>Qo'shish</strong> bosing",
            "O'ngdagi savatda qatorlar to'planadi, <strong>JAMI</strong> summa avtomatik hisoblanadi",
            "Pastdagi tanlovdan PDF yoki PNG ni tanlab <strong>Yuklab olish</strong> bosing",
          ]},
          { type: 'callout', tone: 'tip', title: 'Qidiruv haqida',
            html: 'Qidiruv katta-kichik harfga sezgir emas va opsiya qiymatlari ichidan ham qidiradi — masalan <em>"kraft"</em> deb yozsangiz, kraft qog\'oz opsiyasi bor barcha xizmatlar chiqadi. Maydonni tozalash uchun o\'ng tomondagi × belgisini bosing.' },
        ],
      },
      {
        id: 'ommaviy', title: 'Ommaviy havola',
        blocks: [
          { type: 'p', html: "Narxlar ro'yxatini ommaviy havola sifatida ham ulashish mumkin — mijoz tizimga kirmasdan ko'radi. Havola va brending sozlamalari shu bo'limning o'zida." },
        ],
      },
    ],
  },

  {
    id: 'xodim-qoshish',
    category: 'xodimlar',
    icon: <Users size={16} />,
    title: 'Xodim qo\'shish',
    tags: ['xodim', 'ishchi', 'qoshish', 'parol', 'hodim', 'tahrirlash', 'maosh', 'ozgartirish'],
    intro: 'Yangi xodimlarni tizimga kiritish, ularga login/parol berish va keyinchalik ma\'lumotlarini tahrirlash.',
    sections: [
      {
        id: 'tartib', title: 'Qanday amalga oshiriladi',
        blocks: [
          { type: 'steps', items: [
            'Chap menyudan <strong>Xodimlar</strong> sahifasiga o\'ting',
            '<strong>+ Yangi Xodim</strong> tugmasini bosing',
            'Ism, familiya, telefon raqami va noyob login kiriting',
            '<strong>Lavozim:</strong> ruxsatlarni belgilovchi rolni tanlang (Menejer, Dizayner...)',
            'Saqlanganda tizim <strong>avtomatik parol</strong> generatsiya qiladi va ekranda ko\'rsatadi — xodimga uzating',
          ]},
        ],
      },
      {
        id: 'tahrirlash', title: 'Xodim ma\'lumotlarini tahrirlash',
        blocks: [
          { type: 'steps', items: [
            'Xodimlar sahifasida kerakli xodim qatoriga sichqonchani olib boring',
            'O\'ng tomonda chiqadigan <strong>qalam</strong> belgisini bosing',
            'Ism-familiya, telefon, lavozim, filial va <strong>maosh</strong>ni o\'zgartiring',
            '<strong>Saqlash</strong> bosing — o\'zgarish darhol kuchga kiradi',
          ]},
          { type: 'callout', tone: 'warn', title: 'Login va parol bu yerda o\'zgarmaydi',
            html: 'Xavfsizlik uchun parol alohida oqimda yangilanadi: o\'sha qatordagi <strong>aylanma strelka</strong> tugmasini bosing — yangi parol yaratiladi va ekranda ko\'rsatiladi. Parol yangilangan zahoti xodim barcha qurilmalardan chiqariladi.' },
        ],
      },
      {
        id: 'eslatma', title: 'Eslatma',
        blocks: [
          { type: 'callout', tone: 'info',
            html: 'Yangi xodimga kerakli ruxsat yo\'q bo\'lsa, avval <strong>Sozlamalar → Lavozimlar</strong> bo\'limidan mos rol yarating va checkbox\'lar bilan huquqlarni belgilang.' },
          { type: 'callout', tone: 'info', title: 'Ruxsat',
            html: 'Tahrirlash tugmasi faqat <strong>Xodimni tahrirlash</strong> yoki <strong>Xodimlarni boshqarish</strong> ruxsati bor lavozimlarda ko\'rinadi.' },
        ],
      },
    ],
  },
  {
    id: 'lavozim-yaratish',
    category: 'xodimlar',
    icon: <ShieldCheck size={16} />,
    title: 'Lavozim va ruxsatlar',
    tags: ['lavozim', 'role', 'ruxsat', 'permission', 'admin'],
    intro: 'Lavozim — xodimning ruxsat to\'plami. Sahifa, ko\'rish, qo\'shish, tahrirlash, o\'chirish darajalarini boshqaradi.',
    sections: [
      {
        id: 'tartib', title: 'Yaratish tartibi',
        blocks: [
          { type: 'steps', items: [
            '<strong>Sozlamalar → Lavozimlar & Ruxsatlar</strong> qismi',
            '<strong>+ Yangi Lavozim</strong> tugmasini bosing',
            'Lavozim nomi (Operator, Menejer, Dizayner, Buxgalter...)',
            'Filial — qaysi filialda ishlatilishi',
            'Checkbox\'lar sahifa tartibida guruhlangan: Kassa, Kanban, Xizmatlar, Mijozlar, Ombor — jami 15 ta guruh',
            'Har checkbox ustiga hover — detail tooltip chiqadi',
          ]},
        ],
      },
      {
        id: 'tuzilma', title: 'Ruxsat strukturasi',
        blocks: [
          { type: 'list', items: [
            '<strong>canView*</strong> — sahifani ko\'rish (read-only)',
            '<strong>canAdd*</strong> — yangi element qo\'shish',
            '<strong>canEdit*</strong> — mavjudni tahrirlash',
            '<strong>canDelete*</strong> — o\'chirish',
            '<strong>canManage*</strong> — to\'liq boshqaruv (CRUD + qo\'shimcha)',
          ]},
        ],
      },
    ],
  },
  {
    id: 'maosh',
    category: 'xodimlar',
    icon: <Wallet size={16} />,
    title: 'Maosh — oylik hisob-kitob',
    tags: ['maosh', 'oylik', 'payroll', 'avans', 'bonus', 'jarima', 'kpi'],
    intro: "Oylik hisob-kitob, avans ushlash va Kassadan to'lash. Hisobni lavozimga qarab avtomatlashtirish mumkin.",
    sections: [
      {
        id: 'oylik-chiqarish', title: 'Oylikni chiqarish',
        blocks: [
          { type: 'steps', items: [
            "<strong>Xodimlar → Maosh</strong> tabini oching",
            "Yuqoridan kerakli <strong>oyni</strong> tanlang",
            "Har xodim qatorida <strong>fiksa, bonus, jarima</strong> ustunlarini to'ldiring (yoki avtomatik to'lganini tekshiring)",
            "<strong>To'lash</strong> bosing — Kassadan chiqim yoziladi",
          ]},
          { type: 'code', rows: [
            { cmd: 'Sof maosh', desc: 'fiksa + bonus − jarima' },
            { cmd: 'Berish kerak', desc: 'sof maosh − shu oy avansi − oldingi qarz' },
          ]},
          { type: 'callout', tone: 'info', title: 'Avans va qarz',
            html: 'Kassadan berilgan avans oy yakunida <strong>avtomatik ushlanadi</strong>. Agar avans sof maoshdan ko\'p bo\'lsa, farq keyingi oyga qarz bo\'lib ko\'chadi va o\'sha oyda ushlab qolinadi.' },
          { type: 'callout', tone: 'warn', title: 'Xato bo\'lsa',
            html: "To'langan oyni tahrirlab bo'lmaydi. Avval <strong>Bekor qilish</strong> bosing — Kassadagi chiqim ham qaytariladi, keyin tuzatib qayta to'lang." },
        ],
      },
    ],
  },
  {
    id: 'maosh-sxema',
    category: 'xodimlar',
    icon: <Calculator size={16} />,
    title: 'Maosh sxemasi (avtomatik hisob)',
    tags: ['sxema', 'kpi', 'fiksa', 'avtomatik', 'maosh', 'bonus'],
    intro: "Har lavozim uchun oylik qanday hisoblanishini bir marta belgilaysiz — keyin har oy avtomatik hisoblanadi.",
    sections: [
      {
        id: 'nima-uchun', title: 'Nima uchun kerak',
        blocks: [
          { type: 'p', html: "Har lavozimning oyligi boshqacha hisoblanadi: kimdir faqat qat'iy summa oladi, kimdiki davomatga bog'liq, kimdiki bajargan ishiga qarab o'zgaradi. Sxema shu qoidani bir marta yozib qo'yish imkonini beradi — har oy qo'lda hisoblash shart emas." },
          { type: 'callout', tone: 'info',
            html: 'Sxema belgilanmagan lavozimda hech narsa o\'zgarmaydi — maosh avvalgidek qo\'lda yoziladi.' },
        ],
      },
      {
        id: 'tuzish', title: 'Sxema tuzish',
        blocks: [
          { type: 'steps', items: [
            "<strong>Xodimlar → Maosh sxemasi</strong> tabini oching",
            "<strong>Lavozimni</strong> tanlang",
            "<strong>+ To'lov turi qo'shish</strong> bosing va turini tanlang",
            "Tanlagan turingiz so'ragan maydonlarni to'ldiring",
            "Kerak bo'lsa <strong>shart</strong> qo'shing, so'ng <strong>Saqlash</strong> bosing",
          ]},
          { type: 'code', rows: [
            { cmd: 'Fiksa', desc: "Qat'iy summa. Shart qo'ysangiz — faqat shart bajarilsa beriladi" },
            { cmd: 'KPI', desc: "Natijaga qarab qo'shiladi: nimaga qarab va har biri uchun qancha" },
            { cmd: 'Jarima', desc: 'Hisoblanadi, tasdiqlasangiz ushlab qolinadi' },
          ]},
        ],
      },
      {
        id: 'misol', title: 'Misol: 3 mln fiksa uch qismdan',
        blocks: [
          { type: 'p', html: "Fiksaning o'zi ham shartli bo'lishi mumkin. Masalan 3 000 000 so'mlik oylikni uch qismga bo'lasiz:" },
          { type: 'list', items: [
            "<strong>1 000 000</strong> — asosiy, shartsiz (har doim beriladi)",
            "<strong>1 000 000</strong> — agar ish kunlari kamida 22 bo'lsa",
            "<strong>1 000 000</strong> — agar kechikish 0 daqiqa bo'lsa",
          ]},
          { type: 'p', html: "Xodim 20 kun kelib, 35 daqiqa kechikkan bo'lsa — faqat birinchi qism, ya'ni 1 000 000 so'm beriladi. Qolganlari shart bajarilmagani uchun tushib qoladi va buni Maosh sahifasida sabab bilan ko'rasiz." },
          { type: 'callout', tone: 'tip', title: 'Nisbatan hisoblash',
            html: "\"Kamida\" turidagi shartda <strong>nisbatan berilsin</strong> belgisini qo'ysangiz, 22 dan 20 kun kelgan xodimga summaning 20/22 qismi beriladi — hammasi yoki hech nima o'rniga." },
        ],
      },
      {
        id: 'metrikalar', title: 'KPI nimaga bog\'lanadi',
        blocks: [
          { type: 'list', items: [
            '<strong>Davomat:</strong> ish kunlari, ish soatlari, kechikish daqiqasi, qo\'shimcha ish daqiqasi',
            '<strong>Buyurtmalar:</strong> bajarilgan buyurtmalar soni, ularning summasi, miqdori (dona)',
            '<strong>Moliya:</strong> xodim orqali tushgan kirim',
          ]},
          { type: 'callout', tone: 'info', title: 'Qanday sanaladi',
            html: "Buyurtma <strong>\"bajarildi\" ustuniga ko'chirilgan payt</strong> hisobga olinadi. Bir buyurtmada bir necha xodim ishlagan bo'lsa — har biriga to'liq yoziladi, bo'linmaydi." },
          { type: 'callout', tone: 'warn', title: 'Jarima avtomatik ayrilmaydi',
            html: 'Jarima hisoblanib ko\'rsatiladi, lekin o\'zi ushlab qolinmaydi. Maosh sahifasida xodim qatorini ochib <strong>Qabul qilish</strong> bosasiz yoki o\'zingiz boshqa summa yozasiz.' },
        ],
      },
      {
        id: 'tekshirish', title: 'Hisobni tekshirish',
        blocks: [
          { type: 'p', html: "Maosh sahifasida xodim nomi yonidagi <strong>▸</strong> belgisini bossangiz, hisob qatorma-qator ochiladi: qaysi qism berildi, qaysi biri nima sababdan tushib qoldi." },
          { type: 'callout', tone: 'tip',
            html: 'Avtomatik hisob faqat maydonlarni <strong>oldindan to\'ldiradi</strong>. Har qanday raqamni qo\'lda tuzatib, keyin to\'lashingiz mumkin — oxirgi qaror sizda qoladi.' },
        ],
      },
    ],
  },
  {
    id: 'davomat',
    category: 'xodimlar',
    icon: <QrCode size={16} />,
    title: 'Davomat (QR kod)',
    tags: ['davomat', 'attendance', 'qr', 'keldi', 'ketdi', 'overtime'],
    intro: 'Xodimlar QR kod yoki "Keldim" tugmasi orqali kelish/ketish vaqtini belgilaydi.',
    sections: [
      {
        id: 'xodim', title: 'Xodim uchun',
        blocks: [
          { type: 'steps', items: [
            '<strong>Davomat</strong> sahifasiga kiring',
            '"Keldim" tugmasini bosing — joriy vaqt avtomatik yoziladi',
            'Ish kuni oxirida "Ketdim" tugmasini bosing',
            'Kech qolsangiz Telegram bot orqali sabab yuborish mumkin (Overtime so\'rovi)',
          ]},
        ],
      },
      {
        id: 'admin', title: 'Admin uchun',
        blocks: [
          { type: 'list', items: [
            'Barcha xodimlar kunlik jadvali',
            'Oylik matritsa ko\'rinishi',
            'Qo\'lda davomat kiritish (qurilmasiz xodim uchun)',
            'Ofis Wi-Fi IP allowlist (anti-cheat)',
            'Overtime so\'rovlarini tasdiqlash/rad etish',
          ]},
        ],
      },
    ],
  },

  {
    id: 'kassa-tranzaksiya',
    category: 'moliya',
    icon: <CreditCard size={16} />,
    title: 'Kassa — kirim va chiqim',
    tags: ['kassa', 'pul', 'kirim', 'chiqim', 'tranzaksiya', 'daromad', 'xarajat'],
    intro: 'Barcha moliyaviy kirim-chiqimlarni hisobga olish va kassa qoldig\'ini boshqarish.',
    sections: [
      {
        id: 'kirim', title: 'Kirim (daromad)',
        blocks: [
          { type: 'steps', items: [
            '<strong>Kassa</strong> sahifasiga o\'ting',
            '"Kirim qo\'shish" yashil tugmasini bosing',
            'To\'lov turi (Naqd, Karta), summa va mijozni tanlang',
            '<strong>Saqlash</strong>',
          ]},
        ],
      },
      {
        id: 'chiqim', title: 'Chiqim (xarajat)',
        blocks: [
          { type: 'steps', items: [
            'Kassa sahifasida "Chiqim qo\'shish" qizil tugmasini bosing',
            'Xarajat turini tanlang (Soliq, Maosh, Xom-ashyo...)',
            'Kimga berilganini (xodim yoki hamkor) ko\'rsating',
            '<strong>Saqlash</strong>',
          ]},
        ],
      },
    ],
  },
  {
    id: 'hisobotlar',
    category: 'moliya',
    icon: <BarChart3 size={16} />,
    title: 'Hisobotlar va tahlil',
    tags: ['hisobot', 'report', 'tahlil', 'grafik', 'kpi', 'foyda'],
    intro: 'O\'sish ko\'rsatkichlari, moliyaviy dinamika, xizmat reytingi, KPI va tannarx kalkulyatori.',
    sections: [
      {
        id: 'blok-osish', title: 'O\'sish kartochkalari',
        blocks: [
          { type: 'p', html: 'Bu oy daromad / yangi mijozlar / bajarilgan buyurtmalar — o\'tgan oy bilan foizli taqqoslash.' },
        ],
      },
      {
        id: 'blok-dinamika', title: 'Moliyaviy dinamika',
        blocks: [
          { type: 'p', html: 'Kunlik (1 oy) yoki oylik (3–12 oy) trend grafiklari. Kirim/chiqim/hamkor/sof foyda chiziqlari.' },
        ],
      },
      {
        id: 'blok-turlar', title: 'Kirim/chiqim turlari',
        blocks: [
          { type: 'p', html: 'To\'lov usullari (Naqd, Karta, Click) va xarajat kategoriyalari bo\'yicha pie chart.' },
        ],
      },
      {
        id: 'blok-tannarx', title: 'Tannarx kalkulyatori',
        blocks: [
          { type: 'p', html: 'Buyurtma ID bilan qidirish → xarajat qatorlari → 1 dona tannarx va marja foizi.' },
        ],
      },
      {
        id: 'bolimga-guruhlash', title: 'Bo\'limga guruhlash',
        blocks: [
          { type: 'callout', tone: 'tip',
            html: 'Hisobotlar tepasidagi <strong>"Bo\'limga guruhlash"</strong> tugmasi — har bo\'lim bo\'yicha buyurtma soni va daromadi taqsimotini ko\'ring.' },
        ],
      },
    ],
  },

  {
    id: 'filiallar-bolimlar',
    category: 'tashkilot',
    icon: <Building2 size={16} />,
    title: 'Filiallar va bo\'limlar',
    tags: ['filial', 'branch', 'bolim', 'department', 'multi'],
    intro: 'PrintFlow ko\'p filiallikni qo\'llab-quvvatlaydi. Har filialning xizmatlari, xodimlari, mijozlari va xarajatlari ajratilgan (strict isolation).',
    sections: [
      {
        id: 'filial-qoshish', title: 'Filial qo\'shish',
        blocks: [
          { type: 'steps', items: [
            'Chap menyu → <strong>Boshqaruv → Ma\'muriyat</strong> → <strong>Filiallar</strong> sub-tab',
            '<strong>+ Yangi filial</strong> → nomi, manzil, telefon, mas\'ul xodim',
            'Har register qilingan tenantda "Bosh Ofis (Asosiy)" filial avtomatik mavjud',
          ]},
        ],
      },
      {
        id: 'bolim-qoshish', title: 'Bo\'lim (department) qo\'shish',
        blocks: [
          { type: 'p', html: 'Bo\'lim — analitik teg. Buyurtma va tranzaksiyani qaysi bo\'lim hisobiga yozish uchun (Bosma, Dizayn, Yetkazib berish...).' },
          { type: 'steps', items: [
            'Filiallar sahifasida har filial kartasining pastida <strong>Bo\'limlar</strong> bo\'limini oching',
            'Yangi bo\'lim nomini yozing → <strong>Qo\'shish</strong>',
            'Buyurtma yaratganda yoki Kassa\'da tranzaksiya yozayotganda bo\'lim dropdown\'idan tanlang',
            'Hisobotlarda <strong>Bo\'limga guruhlash</strong> orqali taqsimotni ko\'ring',
          ]},
        ],
      },
      {
        id: 'isolation', title: 'Strict isolation',
        blocks: [
          { type: 'callout', tone: 'warn',
            html: 'Filial A xodimi B filiali xizmatlarini, hamkorlarini ko\'rmaydi. Hisobotlar ham faqat aktiv filial ma\'lumotlarini ko\'rsatadi — navbar\'dan filial almashish mumkin.' },
        ],
      },
    ],
  },

  {
    id: 'telegram-bot',
    category: 'yordamchilar',
    icon: <Send size={16} />,
    title: 'Telegram botni ulash',
    tags: ['telegram', 'bot', 'ulash', 'xabarnoma'],
    intro: 'Telegram bot buyurtmalar va kunlik hisobotlar haqida xabar beradi. Xodimlar vazifalari haqida eslatmalarni shu botdan oladi.',
    sections: [
      {
        id: 'ulanish', title: 'Ulanish tartibi',
        blocks: [
          { type: 'steps', items: [
            'Telegramda botni qidiring (botfather\'dan olingan token bilan)',
            '<strong>/start</strong> komandasini bosing va tilni tanlang',
            'Tizimdagi <strong>Workspace Slug</strong>\'ini (URL\'dagi nom) kiriting',
            'Tizimda sizga ochilgan <strong>Login</strong> va <strong>Parol</strong>ni kiriting',
            'Endi bildirishnomalar kelishni boshlaydi',
          ]},
        ],
      },
      {
        id: 'komandalar', title: 'Qo\'shimcha komandalar',
        blocks: [
          { type: 'code', rows: [
            { cmd: '/update', desc: 'Botni eng so\'nggi versiyaga yangilash (agar qotib qolsa)' },
            { cmd: '/reset',  desc: 'Xotirani butunlay tozalab, boshqatdan tizimga kirish' },
            { cmd: '/logout', desc: 'Faqat o\'z akkauntingizdan chiqish' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'ai-copilot',
    category: 'yordamchilar',
    icon: <Bot size={16} />,
    title: 'AI Copilot',
    tags: ['ai', 'copilot', 'yordamchi', 'avtomatik', 'chatbot'],
    intro: 'Tabiiy tildan buyurtma yarating, xizmat qo\'shing yoki tizim haqida savol bering.',
    sections: [
      {
        id: 'misol', title: 'Misol dialoglar',
        blocks: [
          { type: 'callout', tone: 'info', title: 'Buyurtma yaratish',
            html: '<strong>Siz:</strong> "Sardor uchun Banner Bosma buyurtma yarat, 500 ming zakolat, Bosma bo\'limiga"<br><strong>AI:</strong> "Tushundim. Tasdiqlaysizmi? Buyurtma: Sardor — Banner Bosma, Zakolat: 500 000, Bo\'lim: Bosma..."' },
          { type: 'callout', tone: 'info', title: 'Xizmat qo\'shish',
            html: '<strong>Siz:</strong> "Yangi xizmat: Vizitka 100x60, 30000 narx, dona birlik"<br><strong>AI:</strong> "Yaratdim. ID: xxx — endi katalogda ko\'rinadi."' },
        ],
      },
      {
        id: 'ochish', title: 'Qanday ochiladi',
        blocks: [
          { type: 'p', html: 'AI ikonkasini bosing yoki <strong>Ctrl + /</strong> tugmalarini bosing. Chat sahifaning <strong>o\'ng tomonida</strong> ochiladi va sahifa mazmunini bosib qolmaydi — kontent qisqaradi, chat u bilan bir chiziqda turadi. Shuning uchun ishlab turib chatni ochiq qoldirsangiz ham bo\'ladi.' },
          { type: 'callout', tone: 'warn', title: 'Ko\'rinmayaptimi?',
            html: 'AI butunlay platforma ma\'muriyati nazoratida — lavozim sozlamalarida yoqiladigan ruxsat yo\'q. Chat ko\'rinishi uchun: (1) platformada AI global yoqilgan, (2) <strong>workspace tarifingizda AI moduli</strong> bo\'lishi kerak. Ko\'pincha ikkinchisi sabab bo\'ladi — tarifingizni <strong>Sozlamalar → Billing</strong> dan ko\'rasiz, o\'zgartirish uchun platforma ma\'muriyatiga murojaat qiling.' },
        ],
      },
      {
        id: 'qollanmadan', title: 'Tizim savollariga javob',
        blocks: [
          { type: 'p', html: '"Xodimni qayerdan qo\'shaman?" kabi yo\'l-yo\'riq savollariga AI javobni <strong>shu Qo\'llanmadan</strong> oladi — tizimni tekshirib o\'tirmaydi. Shuning uchun javob bir zumda keladi va har doim bir xil bo\'ladi.' },
          { type: 'callout', tone: 'tip', title: 'Xarajat',
            html: 'Qo\'llanmadan berilgan javoblar va takrorlangan savollar AI so\'rov limitingizdan <strong>hisoblanmaydi</strong> — ular umuman modelga yuborilmaydi.' },
        ],
      },
    ],
  },
  {
    id: 'ai-xavf-nazorati',
    category: 'yordamchilar',
    icon: <Sparkles size={16} />,
    title: 'AI xavf nazorati',
    tags: ['xavf', 'risk', 'ogohlantirish', 'nazorat', 'avtonom', 'bartaraf'],
    intro: "AI butun tizimni fonda kuzatadi va modullarni o'zaro solishtirib, alohida qaraganda ko'rinmaydigan muammolarni topadi.",
    sections: [
      {
        id: 'nima', title: 'Qanday ishlaydi',
        blocks: [
          { type: 'p', html: "AI bitta modulga emas, <strong>bog'liqliklarga</strong> qaraydi — bir joydagi voqeani boshqa joydagi holat bilan solishtiradi. Topilgan muammolar Dashboard'ning yuqorisida karta bo'lib chiqadi." },
          { type: 'list', items: [
            "<strong>Buyurtma × Davomat</strong> — bugun topshiriladigan buyurtma bor, lekin unga biriktirilgan xodim ishga kelmagan",
            "<strong>Buyurtma × Ombor</strong> — buyurtma uchun kerakli material qoldig'i yetishmaydi",
            "<strong>Mijoz × Buyurtma</strong> — qarzi bor mijozga yana yangi buyurtma ochilgan",
          ]},
          { type: 'callout', tone: 'info', title: 'Limitga tegmaydi',
            html: 'Bu nazorat fonda deterministik hisob-kitob bilan bajariladi — AI so\'rov limitingizdan <strong>hisoblanmaydi</strong> va pul sarflamaydi.' },
        ],
      },
      {
        id: 'bartaraf', title: 'Muammoni hal qilish',
        blocks: [
          { type: 'steps', items: [
            "Kartadagi <strong>Bartaraf etish</strong> tugmasini bosing",
            "AI suhbati oldindan to'ldirilgan so'rov bilan ochiladi",
            "AI yechimni taklif qiladi va tasdiqlaganingizdan keyin bajaradi",
          ]},
          { type: 'list', items: [
            "Muammo o'z-o'zidan hal bo'lsa (masalan xodim kelib davomat belgilasa) karta <strong>avtomatik yopiladi</strong>",
            "Keraksiz kartani <strong>Yopish</strong> tugmasi bilan olib tashlaysiz — u qayta chiqmaydi",
            "Kartani <em>ko'rish</em> uchun AI ruxsati shart emas, faqat <em>bartaraf etish</em> tugmasi AI ruxsatiga bog'liq",
          ]},
          { type: 'callout', tone: 'tip', title: 'Yoqish / o\'chirish',
            html: 'Sozlamalardagi <strong>Agent siyosati</strong> bo\'limidan xavf nazoratini butunlay o\'chirib qo\'yish mumkin.' },
        ],
      },
    ],
  },
  {
    id: 'ai-limit',
    category: 'yordamchilar',
    icon: <CreditCard size={16} />,
    title: "AI so'rov limiti va qo'shimcha paket",
    tags: ['limit', 'kredit', 'paket', 'ai', 'sorov', 'billing', 'tolov'],
    intro: "Har tarifda kunlik va oylik AI so'rov limiti bor. Limit tugasa qo'shimcha paket sotib olish mumkin.",
    sections: [
      {
        id: 'limit', title: 'Limitni kuzatish',
        blocks: [
          { type: 'p', html: "Chat oynasining yuqorisidagi indikator kunlik va oylik qolgan so'rovlarni ko'rsatadi. Kunlik hisob har kuni <strong>yarim tunda</strong> (Toshkent vaqti) tiklanadi." },
          { type: 'callout', tone: 'info', title: 'Nima hisoblanadi',
            html: 'Faqat modelga yuboriladigan jonli savollar hisoblanadi. Qo\'llanmadan berilgan javoblar, takrorlangan savollar va AI\'ning fondagi nazorat ishlari <strong>hisoblanmaydi</strong>.' },
        ],
      },
      {
        id: 'paket', title: "Qo'shimcha paket sotib olish",
        blocks: [
          { type: 'steps', items: [
            "<strong>Sozlamalar → Billing</strong> bo'limini oching",
            "Qo'shimcha so'rov paketlaridan mosini tanlang",
            "To'lovni amalga oshirib chekni yuklang",
            "Admin tasdiqlagach kreditlar hisobingizga qo'shiladi",
          ]},
          { type: 'callout', tone: 'tip', title: 'Kreditlar qanday sarflanadi',
            html: 'Kreditlar faqat asosiy limit tugagandan keyin ishlatiladi — kunlik yoki oylik, qaysi biri to\'lgan bo\'lsa. Ular kuyib ketmaydi, keyingi oyga o\'tadi.' },
        ],
      },
    ],
  },
];

// =============================================
// Helpers
// =============================================

// Search highlight — qidiruv so'zini <mark>'ga o'raydi (HTML xavfsiz).
// Block ichidagi html allaqachon ishonchli (kod ichida yozilgan) — to'g'ridan-to'g'ri
// regex bilan tag oralig'idagi matnga qo'llaymiz.
function highlightHtml(html: string, q: string): string {
  if (!q.trim()) return html;
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(>[^<]*?)(${escaped})`, 'gi');
  // Faqat tag tashqarisidagi (>...< oralig'idagi) matnda highlight qilamiz.
  return html.replace(re, (_, prefix, match) =>
    `${prefix}<mark class="bg-primary-100 text-primary-900 rounded px-0.5">${match}</mark>`
  );
}

function guideMatches(g: Guide, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.toLowerCase();
  if (g.title.toLowerCase().includes(needle)) return true;
  if (g.intro.toLowerCase().includes(needle)) return true;
  if (g.tags.some(t => t.toLowerCase().includes(needle))) return true;
  return g.sections.some(s =>
    s.title.toLowerCase().includes(needle) ||
    s.blocks.some(b => JSON.stringify(b).toLowerCase().includes(needle))
  );
}

// =============================================
// Block renderer
// =============================================

const CALLOUT_STYLE: Record<'info' | 'tip' | 'warn', { bg: string; border: string; icon: React.ComponentType<any>; iconColor: string }> = {
  info: { bg: 'bg-slate-50', border: 'border-slate-200', icon: Info, iconColor: 'text-slate-500' },
  tip:  { bg: 'bg-primary-50', border: 'border-primary-200', icon: Lightbulb, iconColor: 'text-[color:var(--primary)]' },
  warn: { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-700' },
};

function RenderBlock({ block, search }: { block: Block; search: string }) {
  if (block.type === 'p') {
    return (
      <p
        className="text-base leading-7 text-slate-700"
        dangerouslySetInnerHTML={{ __html: highlightHtml(block.html, search) }}
      />
    );
  }

  if (block.type === 'steps') {
    return (
      <ol className="space-y-3 my-2">
        {block.items.map((html, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[color:var(--primary)] text-white text-xs font-semibold flex items-center justify-center mt-0.5 tabular-nums">
              {i + 1}
            </span>
            <span
              className="text-base leading-7 text-slate-700 flex-1"
              dangerouslySetInnerHTML={{ __html: highlightHtml(html, search) }}
            />
          </li>
        ))}
      </ol>
    );
  }

  if (block.type === 'list') {
    return (
      <ul className="space-y-2 my-2">
        {block.items.map((html, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[color:var(--primary)] mt-3" />
            <span
              className="text-base leading-7 text-slate-700 flex-1"
              dangerouslySetInnerHTML={{ __html: highlightHtml(html, search) }}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === 'callout') {
    const cfg = CALLOUT_STYLE[block.tone];
    const Icon = cfg.icon;
    return (
      <div className={`${cfg.bg} ${cfg.border} border rounded-card p-4 flex gap-3 items-start`}>
        <Icon size={18} className={`${cfg.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          {block.title && (
            <p className="t-h3 mb-1">{block.title}</p>
          )}
          <div
            className="text-sm leading-6 text-slate-700"
            dangerouslySetInnerHTML={{ __html: highlightHtml(block.html, search) }}
          />
        </div>
      </div>
    );
  }

  if (block.type === 'kbd') {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <div className="flex items-center gap-2">
          {block.combo.map((k, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-slate-400 font-medium">+</span>}
              <kbd className="px-3 py-1.5 bg-white border border-slate-200 rounded-control text-sm font-semibold text-slate-700">
                {k}
              </kbd>
            </React.Fragment>
          ))}
        </div>
        {block.note && <p className="t-caption">{block.note}</p>}
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <div className="rounded-card border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {block.rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-slate-50 transition-colors duration-120">
            <code className="font-mono text-sm text-[color:var(--primary)] bg-primary-50 px-2 py-1 rounded font-medium flex-shrink-0">
              {row.cmd}
            </code>
            <span
              className="text-sm text-slate-600 flex-1"
              dangerouslySetInnerHTML={{ __html: highlightHtml(row.desc, search) }}
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// =============================================
// Main component
// =============================================

export default function Qollanma() {
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string>(GUIDES[0].id);
  const [activeSection, setActiveSection] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set(CATEGORIES.map(c => c.id)));

  const contentRef = useRef<HTMLDivElement>(null);

  const filteredGuides = useMemo(
    () => GUIDES.filter(g => guideMatches(g, search)),
    [search],
  );

  // Agar joriy guide qidiruvga tushmasa, birinchi mosini tanlaymiz
  useEffect(() => {
    if (!search.trim()) return;
    if (filteredGuides.length === 0) return;
    if (!filteredGuides.find(g => g.id === activeId)) {
      setActiveId(filteredGuides[0].id);
    }
  }, [search, filteredGuides, activeId]);

  const activeGuide = useMemo(() => GUIDES.find(g => g.id === activeId), [activeId]);
  const activeIdx = useMemo(() => GUIDES.findIndex(g => g.id === activeId), [activeId]);
  const prevGuide = activeIdx > 0 ? GUIDES[activeIdx - 1] : null;
  const nextGuide = activeIdx >= 0 && activeIdx < GUIDES.length - 1 ? GUIDES[activeIdx + 1] : null;

  const activeCategory = useMemo(
    () => CATEGORIES.find(c => c.id === activeGuide?.category),
    [activeGuide],
  );

  // Guide o'zgarsa scroll'ni yuqoriga + birinchi sectionni aktiv qilamiz
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setActiveSection(activeGuide?.sections[0]?.id ?? '');
  }, [activeId, activeGuide]);

  // TOC active state — heading'lar scroll'da ko'ringani bo'yicha
  useEffect(() => {
    if (!contentRef.current || !activeGuide) return;
    const container = contentRef.current;
    const headings = activeGuide.sections
      .map(s => container.querySelector<HTMLElement>(`[data-section-id="${s.id}"]`))
      .filter((el): el is HTMLElement => !!el);
    if (headings.length === 0) return;

    const onScroll = () => {
      const top = container.scrollTop;
      let current = headings[0].dataset.sectionId ?? '';
      for (const h of headings) {
        if (h.offsetTop - 80 <= top) current = h.dataset.sectionId ?? current;
        else break;
      }
      setActiveSection(current);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, [activeGuide]);

  const goToSection = useCallback((sectionId: string) => {
    const el = contentRef.current?.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`);
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
    }
  }, []);

  const toggleCat = (id: string) => {
    setOpenCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const restartTour = () => {
    try {
      const raw = localStorage.getItem('pf_user_info') || sessionStorage.getItem('pf_user_info');
      if (raw) {
        const user = JSON.parse(raw);
        if (user?.tenantId) {
          localStorage.removeItem(`pf_tour_${user.tenantId}`);
          localStorage.removeItem(`pf_tour_step_${user.tenantId}`);
          localStorage.removeItem(`pf_onboarded_${user.tenantId}`);
        }
      }
    } catch {}
    window.location.href = '/dashboard';
  };

  // Sidebar — guruhlar bo'yicha
  const sidebarContent = (
    <>
      <div className="px-4 pt-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-control bg-[color:var(--primary)] flex items-center justify-center flex-shrink-0">
            <Book size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="t-h3">Qo'llanma</h2>
            <p className="label-caps">Yordam markazi</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Yopish"
            className="icon-btn-sm md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Qidir..."
            className="input-minimal pl-9"
          />
        </div>

        <button onClick={restartTour} className="btn-primary w-full mt-3">
          <PlayCircle size={16} /> Tour qaytadan
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 custom-scroll">
        {CATEGORIES.map(cat => {
          const items = filteredGuides.filter(g => g.category === cat.id);
          if (items.length === 0) return null;
          const isOpen = openCats.has(cat.id) || !!search.trim();
          return (
            <div key={cat.id} className="mb-1">
              <button
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-control label-caps hover:text-slate-700 hover:bg-slate-50 transition-colors duration-120"
              >
                <span className="truncate">{cat.label}</span>
                <ChevronDown size={16} className={`flex-shrink-0 transition-transform duration-180 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {items.map(g => (
                    <button
                      key={g.id}
                      onClick={() => { setActiveId(g.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-control border text-left transition-colors duration-120 ${
                        activeId === g.id
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className={`flex-shrink-0 ${activeId === g.id ? 'text-[color:var(--primary)]' : 'text-slate-500'}`}>
                        {g.icon}
                      </span>
                      <span className="text-sm font-medium leading-tight flex-1 truncate">
                        {g.title}
                      </span>
                      {activeId === g.id && <ChevronRight size={16} className="text-[color:var(--primary)] flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredGuides.length === 0 && (
          <div className="text-center py-8 px-4">
            <Search size={20} className="mx-auto text-slate-300 mb-2" />
            <p className="t-caption">Hech narsa topilmadi</p>
          </div>
        )}
      </nav>
    </>
  );

  return (
    <div className="h-full bg-white text-slate-900 font-sans selection:bg-primary-100 flex rounded-card border border-slate-200 overflow-hidden">

      {/* Sidebar — desktop sticky, mobile drawer */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r border-slate-200 bg-slate-50/50 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-overlay md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(18rem,88vw)] bg-white flex flex-col shadow-xl animate-slide-left">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex min-w-0">
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto custom-scroll"
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 md:py-12">

            {/* Mobile open-sidebar + breadcrumb */}
            <div className="flex flex-wrap items-center gap-2 mb-6 t-caption">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Bo'limlar"
                className="md:hidden icon-btn-sm border border-slate-200 mr-1"
              >
                <Menu size={16} />
              </button>
              <span>Qo'llanma</span>
              {activeCategory && (
                <>
                  <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
                  <span>{activeCategory.label}</span>
                </>
              )}
              {activeGuide && (
                <>
                  <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
                  <span className="text-[color:var(--primary)] truncate">{activeGuide.title}</span>
                </>
              )}
            </div>

            {activeGuide ? (
              <>
                <header className="mb-8">
                  <h1
                    className="page-title text-xl sm:text-2xl leading-tight mb-3"
                    dangerouslySetInnerHTML={{ __html: highlightHtml(activeGuide.title, search) }}
                  />
                  <p
                    className="text-base text-slate-500 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: highlightHtml(activeGuide.intro, search) }}
                  />
                </header>

                <article className="space-y-8 sm:space-y-10">
                  {activeGuide.sections.map(section => (
                    <section key={section.id} data-section-id={section.id}>
                      <h2 className="t-h2 mb-4 flex items-center gap-2">
                        <span className="w-1 h-5 bg-[color:var(--primary)] rounded-full flex-shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: highlightHtml(section.title, search) }} />
                      </h2>
                      <div className="space-y-4 pl-3">
                        {section.blocks.map((block, i) => (
                          <RenderBlock key={i} block={block} search={search} />
                        ))}
                      </div>
                    </section>
                  ))}
                </article>

                {/* Prev/Next */}
                <nav className="mt-12 sm:mt-16 pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {prevGuide ? (
                    <button
                      onClick={() => setActiveId(prevGuide.id)}
                      className="group flex items-center gap-3 p-4 rounded-card border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors duration-120 text-left"
                    >
                      <ChevronLeft size={18} className="text-slate-500 group-hover:text-[color:var(--primary)] flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="label-caps mb-0.5">Avvalgi</p>
                        <p className="t-h3 group-hover:text-primary-700 truncate">{prevGuide.title}</p>
                      </div>
                    </button>
                  ) : <div />}
                  {nextGuide ? (
                    <button
                      onClick={() => setActiveId(nextGuide.id)}
                      className="group flex items-center justify-end gap-3 p-4 rounded-card border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors duration-120 text-right"
                    >
                      <div className="min-w-0">
                        <p className="label-caps mb-0.5">Keyingi</p>
                        <p className="t-h3 group-hover:text-primary-700 truncate">{nextGuide.title}</p>
                      </div>
                      <ChevronRight size={18} className="text-slate-500 group-hover:text-[color:var(--primary)] flex-shrink-0" />
                    </button>
                  ) : <div />}
                </nav>

                <footer className="mt-12 pt-6 border-t border-slate-200 t-caption">
                  PrintFlow Docs &copy; {new Date().getFullYear()}
                </footer>
              </>
            ) : (
              <EmptyState
                icon={Search}
                title="Mavzu topilmadi"
                description="Qidiruv so'zini o'zgartirib ko'ring yoki chapdagi ro'yxatdan bo'lim tanlang."
              />
            )}
          </div>
        </main>

        {/* TOC — sticky right, faqat lg+ */}
        {activeGuide && activeGuide.sections.length > 1 && (
          <aside className="hidden lg:block w-56 flex-shrink-0 border-l border-slate-200 px-5 py-12">
            <div className="sticky top-12">
              <p className="label-caps mb-3">Bu sahifada</p>
              <nav className="space-y-1">
                {activeGuide.sections.map(s => (
                  <button
                    key={s.id}
                    onClick={() => goToSection(s.id)}
                    className={`w-full text-left text-sm leading-snug py-1.5 pl-3 border-l-2 transition-colors duration-120 ${
                      activeSection === s.id
                        ? 'border-[color:var(--primary)] text-primary-700 font-semibold'
                        : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
