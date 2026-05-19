import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search, Book, ChevronRight, ChevronLeft, ChevronDown, Menu, X,
  PlayCircle, LayoutTemplate, Layers, Users, CreditCard,
  Building2, ShieldCheck, BarChart3, QrCode, Bot, Command, Sparkles, Send,
  Info, AlertTriangle, Lightbulb,
} from 'lucide-react';

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
    id: 'xodim-qoshish',
    category: 'xodimlar',
    icon: <Users size={16} />,
    title: 'Xodim qo\'shish',
    tags: ['xodim', 'ishchi', 'qoshish', 'parol', 'hodim'],
    intro: 'Yangi xodimlarni tizimga kiritish va ularga login/parol berish.',
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
        id: 'eslatma', title: 'Eslatma',
        blocks: [
          { type: 'callout', tone: 'info',
            html: 'Yangi xodimga kerakli ruxsat yo\'q bo\'lsa, avval <strong>Sozlamalar → Lavozimlar</strong> bo\'limidan mos rol yarating va checkbox\'lar bilan huquqlarni belgilang.' },
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
          { type: 'p', html: 'Sahifa pastida AI ikonkasi yoki <strong>Ctrl + /</strong> bosing. AI sizning kontekstingizdan kelib chiqib javob beradi.' },
          { type: 'callout', tone: 'warn', title: 'Eslatma',
            html: 'AI Copilot Super Admin tomonidan yoqilgan bo\'lishi kerak. Agar ko\'rinmasa — faol emas.' },
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
    `${prefix}<mark class="bg-orange-100 text-orange-900 rounded px-0.5">${match}</mark>`
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
  tip:  { bg: 'bg-orange-50/60', border: 'border-orange-200', icon: Lightbulb, iconColor: 'text-orange-600' },
  warn: { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-700' },
};

function RenderBlock({ block, search }: { block: Block; search: string }) {
  if (block.type === 'p') {
    return (
      <p
        className="text-[15px] leading-7 text-slate-700"
        dangerouslySetInnerHTML={{ __html: highlightHtml(block.html, search) }}
      />
    );
  }

  if (block.type === 'steps') {
    return (
      <ol className="space-y-3 my-2">
        {block.items.map((html, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span
              className="text-[15px] leading-7 text-slate-700 flex-1"
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
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-orange-500 mt-3" />
            <span
              className="text-[15px] leading-7 text-slate-700 flex-1"
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
      <div className={`${cfg.bg} ${cfg.border} border rounded-xl p-4 flex gap-3 items-start`}>
        <Icon size={18} className={`${cfg.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          {block.title && (
            <p className="font-bold text-slate-800 text-sm mb-1">{block.title}</p>
          )}
          <div
            className="text-[14px] leading-6 text-slate-700"
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
              {i > 0 && <span className="text-slate-300 font-bold">+</span>}
              <kbd className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                {k}
              </kbd>
            </React.Fragment>
          ))}
        </div>
        {block.note && <p className="text-xs text-slate-400 font-medium">{block.note}</p>}
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {block.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 transition-colors">
            <code className="font-mono text-[13px] text-orange-600 bg-orange-50 px-2 py-1 rounded font-bold flex-shrink-0">
              {row.cmd}
            </code>
            <span
              className="text-[14px] text-slate-600 flex-1"
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
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Book size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-800 text-sm leading-tight">Qo'llanma</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Yordam markazi</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Qidir..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all"
          />
        </div>

        <button
          onClick={restartTour}
          className="w-full mt-3 flex items-center justify-center gap-2 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
        >
          <PlayCircle size={13} /> Tour qaytadan
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
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>{cat.label}</span>
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {items.map(g => (
                    <button
                      key={g.id}
                      onClick={() => { setActiveId(g.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg text-left transition-colors ${
                        activeId === g.id
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className={activeId === g.id ? 'text-orange-500' : 'text-slate-400'}>
                        {g.icon}
                      </span>
                      <span className="text-[13px] font-medium leading-tight flex-1 truncate">
                        {g.title}
                      </span>
                      {activeId === g.id && <ChevronRight size={12} className="text-orange-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredGuides.length === 0 && (
          <div className="text-center py-8 px-4">
            <Search size={24} className="mx-auto text-slate-200 mb-2" />
            <p className="text-xs font-bold text-slate-400">Hech narsa topilmadi</p>
          </div>
        )}
      </nav>
    </>
  );

  return (
    <div className="h-full bg-white text-slate-900 font-sans selection:bg-orange-100 flex rounded-2xl border border-slate-200 overflow-hidden">

      {/* Sidebar — desktop sticky, mobile drawer */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r border-slate-100 bg-slate-50/30 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-2xl">
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
          <div className="max-w-3xl mx-auto px-6 md:px-10 py-8 md:py-12">

            {/* Mobile open-sidebar + breadcrumb */}
            <div className="flex items-center gap-3 mb-6 text-[11px] font-bold uppercase tracking-wider">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden w-8 h-8 rounded-lg border border-slate-200 hover:border-slate-300 flex items-center justify-center text-slate-500 mr-1"
              >
                <Menu size={14} />
              </button>
              <span className="text-slate-400">Qo'llanma</span>
              {activeCategory && (
                <>
                  <ChevronRight size={11} className="text-slate-300" />
                  <span className="text-slate-400">{activeCategory.label}</span>
                </>
              )}
              {activeGuide && (
                <>
                  <ChevronRight size={11} className="text-slate-300" />
                  <span className="text-orange-600 truncate">{activeGuide.title}</span>
                </>
              )}
            </div>

            {activeGuide ? (
              <>
                <header className="mb-8">
                  <h1
                    className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight mb-3"
                    dangerouslySetInnerHTML={{ __html: highlightHtml(activeGuide.title, search) }}
                  />
                  <p
                    className="text-base text-slate-500 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: highlightHtml(activeGuide.intro, search) }}
                  />
                </header>

                <article className="space-y-10">
                  {activeGuide.sections.map(section => (
                    <section key={section.id} data-section-id={section.id}>
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
                        <span className="w-1 h-5 bg-orange-500 rounded-full" />
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
                <nav className="mt-16 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {prevGuide ? (
                    <button
                      onClick={() => setActiveId(prevGuide.id)}
                      className="group flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 transition-all text-left"
                    >
                      <ChevronLeft size={18} className="text-slate-400 group-hover:text-orange-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Avvalgi</p>
                        <p className="text-sm font-bold text-slate-700 group-hover:text-orange-700 truncate">{prevGuide.title}</p>
                      </div>
                    </button>
                  ) : <div />}
                  {nextGuide ? (
                    <button
                      onClick={() => setActiveId(nextGuide.id)}
                      className="group flex items-center justify-end gap-3 p-4 rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 transition-all text-right"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Keyingi</p>
                        <p className="text-sm font-bold text-slate-700 group-hover:text-orange-700 truncate">{nextGuide.title}</p>
                      </div>
                      <ChevronRight size={18} className="text-slate-400 group-hover:text-orange-500 flex-shrink-0" />
                    </button>
                  ) : <div />}
                </nav>

                <footer className="mt-12 pt-6 border-t border-slate-100 text-xs text-slate-400">
                  PrintFlow Docs &copy; {new Date().getFullYear()}
                </footer>
              </>
            ) : (
              <div className="text-center py-24">
                <Search size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm font-bold text-slate-400">Mavzu topilmadi</p>
              </div>
            )}
          </div>
        </main>

        {/* TOC — sticky right, faqat lg+ */}
        {activeGuide && activeGuide.sections.length > 1 && (
          <aside className="hidden lg:block w-56 flex-shrink-0 border-l border-slate-100 px-5 py-12">
            <div className="sticky top-12">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Bu sahifada</p>
              <nav className="space-y-1">
                {activeGuide.sections.map(s => (
                  <button
                    key={s.id}
                    onClick={() => goToSection(s.id)}
                    className={`w-full text-left text-[12px] leading-snug py-1.5 pl-3 border-l-2 transition-colors ${
                      activeSection === s.id
                        ? 'border-orange-500 text-orange-700 font-bold'
                        : 'border-slate-100 text-slate-500 hover:text-slate-800 hover:border-slate-300'
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
