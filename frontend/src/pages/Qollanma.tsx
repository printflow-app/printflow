import React, { useState, useMemo } from 'react';
import { Search, Book, ChevronRight, FileText, Users, CreditCard, LayoutTemplate, PlayCircle, Building2, Layers, ShieldCheck, BarChart3, QrCode, Bot, Command, Sparkles } from 'lucide-react';

const GUIDES = [
  {
    id: 'buyurtma-qoshish',
    icon: <LayoutTemplate size={18} />,
    title: "Yangi buyurtma qanday qo'shiladi?",
    tags: ['buyurtma', 'task', 'yangi', 'qoshish', 'zakaz', 'kanban'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Yangi buyurtma (zakaz) qo'shish</h1>
        <p className="text-slate-600 leading-relaxed">Mijozdan tushgan yangi buyurtmalarni tizimga kiritish va kanban doskasiga joylash qoidasi.</p>
        
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 my-6">
          <h3 className="font-bold text-orange-800 mb-2">Qadam-baqadam yo'riqnoma:</h3>
          <ol className="list-decimal pl-5 space-y-3 text-orange-900/80 font-medium">
            <li>Chap menyudan <strong>"Buyurtmalar" (Kanban)</strong> bo'limiga kiring.</li>
            <li>O'ng yuqori burchakdagi <strong>"+ Yangi Buyurtma"</strong> apelsin rangli tugmasini bosing.</li>
            <li>Buyurtma nomi va mijozni tanlang (yoki yangi mijoz ismini kiriting).</li>
            <li><strong>Xizmat turi:</strong> Qaysi xizmat qilinishini ro'yxatdan tanlang.</li>
            <li><strong>Opsiyalar:</strong> Qog'oz qalinligi, rang kabi qo'shimcha xususiyatlarni belgilang (narx avtomat o'zgaradi).</li>
            <li><strong>Moliya:</strong> Buyurtma narxi va oldindan to'lov (zakolat) summasini kiriting.</li>
            <li>Tugatgach <strong>"Saqlash"</strong> tugmasini bosing. Buyurtma birinchi bosqichga qo'shiladi!</li>
          </ol>
        </div>
      </div>
    )
  },
  {
    id: 'xizmat-qoshish',
    icon: <Layers size={18} />,
    title: "Xizmatlar Katalogi (Pricing Engine)",
    tags: ['xizmat', 'katalog', 'qoshish', 'narx', 'mahsulot', 'opsiya', 'pricing'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Xizmat va Mahsulot qo'shish</h1>
        <p className="text-slate-600 leading-relaxed">Tizimga yangi xizmat turini qo'shish, opsiyalar bilan moslashuvchan narxlar va material normalari (BOM) yaratish.</p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-6">
          <h3 className="font-bold text-slate-800 mb-2">Xizmat qo'shish tartibi:</h3>
          <ol className="list-decimal pl-5 space-y-3 text-slate-700">
            <li>Chap menyuda <strong>Operatsiya</strong> guruhi ostidan <strong>"Xizmatlar katalogi"</strong> tabini oching <em>(yangi: avval Sozlamalar ichida edi, endi alohida tab — paradox tuzatildi)</em>.</li>
            <li>O'ng yuqori burchakdagi <strong>"+ Yangi Xizmat"</strong> tugmasini bosing.</li>
            <li>Xizmat nomini (masalan, <em>"Vizitka"</em>, <em>"Banner"</em>), o'lchov birligini (dona, m², metr) va asosiy narxni kiriting.</li>
            <li>Yaratgandan so'ng, xizmat kartasini ochib <strong>Opsiyalar</strong> qo'shing — masalan "Qog'oz qalinligi", "Laminatsiya". Har opsiya bazaviy narxga foiz qo'shadi.</li>
            <li><strong>Material normasi (BOM):</strong> Har 1 dona xizmat uchun qancha material sarflanishini belgilash mumkin. Buyurtma yaratilganda omborda avtomatik band qilinadi.</li>
          </ol>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
          <p className="font-bold text-sm">Diqqat — strict isolation:</p>
          <p className="text-xs mt-1">Har xizmat ma'lum filialga tegishli. Bir filial xizmati boshqa filialda ko'rinmaydi. Boshqa filialga ko'chirish uchun <strong>"Clone"</strong> tugmasini bosing.</p>
        </div>
      </div>
    )
  },
  {
    id: 'xodim-qoshish',
    icon: <Users size={18} />,
    title: "Xodim qo'shish va Ruxsatlar berish",
    tags: ['xodim', 'ishchi', 'qoshish', 'ruxsat', 'rol', 'parol', 'hodim'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Xodim qo'shish</h1>
        <p className="text-slate-600 leading-relaxed">Yangi xodimlarni tizimga kiritish va ularga tegishli huquqlarni berish qoidalari.</p>
        
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 my-6">
          <h3 className="font-bold text-indigo-800 mb-2">Qanday amalga oshiriladi?</h3>
          <ol className="list-decimal pl-5 space-y-3 text-indigo-900/80">
            <li>Chap menyudan <strong>"Xodimlar"</strong> sahifasiga o'ting.</li>
            <li><strong>"+ Yangi Xodim"</strong> tugmasini bosing.</li>
            <li>Ism, familiyasi, telefon raqami va noyob logini kiriting.</li>
            <li><strong>Lavozimi:</strong> Xodim uchun tizimda nimalar ruxsat etilganini belgilovchi rolni tanlang (Masalan: Menejer, Dizayner).</li>
            <li>Saqlash tugmasi bosilgach, tizim <strong>avtomatik tarzda unikal parol generatsiya qiladi</strong> va ekranda ko'rsatadi. Bu parolni xodimga bering!</li>
          </ol>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
          <p className="font-bold">Eslatma:</p>
          <p className="text-sm mt-1">Yangi xodimga kerakli ruxsatlar yo'q bo'lsa, avval <strong>Sozlamalar &gt; Lavozimlar (Roles)</strong> bo'limidan mos rol yarating va unda kerakli huquqlarni belgilang.</p>
        </div>
      </div>
    )
  },
  {
    id: 'kassa-tranzaksiya',
    icon: <CreditCard size={18} />,
    title: "Kassa, Kirim va Chiqim amallari",
    tags: ['kassa', 'pul', 'kirim', 'chiqim', 'tranzaksiya', 'daromad', 'xarajat'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Kassa boshqaruvi</h1>
        <p className="text-slate-600 leading-relaxed">Tashkilotdagi barcha moliyaviy kirim-chiqimlarni hisobga olish va kassa qoldig'ini boshqarish.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <h3 className="font-bold text-emerald-800 mb-2">Kirim (Daromad) qo'shish</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-emerald-900/80">
              <li><strong>Kassa</strong> sahifasiga o'ting.</li>
              <li>"Kirim qo'shish" yashil tugmasini bosing.</li>
              <li>To'lov turi (Naqd, Karta), summa va asosiy mijozni tanlang.</li>
            </ul>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
            <h3 className="font-bold text-rose-800 mb-2">Chiqim (Xarajat) qo'shish</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-rose-900/80">
              <li><strong>Kassa</strong> sahifasida "Chiqim qo'shish" qizil tugmasini bosing.</li>
              <li>Xarajat turini tanlang (Soliq, Maosh, Xom-ashyo).</li>
              <li>Kimga (xodim yoki hamkorga) berilgan bo'lsa, shuni ko'rsating va saqlang.</li>
            </ul>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'telegram-bot',
    icon: <Search size={18} />,
    title: "Telegram Botni qanday ulash mumkin?",
    tags: ['telegram', 'bot', 'ulash', 'xabarnoma', 'notifikatsiya', 'update'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Telegram Bot orqali ishlash</h1>
        <p className="text-slate-600 leading-relaxed">Telegram bot sizga buyurtmalar va kunlik hisobotlar haqida xabar berib turadi. Xodimlar ham o'z vazifalari bo'yicha eslatmalarni shu botdan olishadi.</p>
        
        <div className="bg-[#0088cc]/10 border border-[#0088cc]/20 rounded-xl p-4 my-6">
          <h3 className="font-bold text-[#0088cc] mb-2">Ulanish tartibi:</h3>
          <ol className="list-decimal pl-5 space-y-3 text-[#0088cc]/80 font-medium">
            <li>Telegramda botni qidiring (Token orqali botfatherdan olingan bot).</li>
            <li><strong>/start</strong> komandasini bosing va o'z tilingizni tanlang.</li>
            <li>Tizimdagi kompaniyangizning <strong>Workspace Slug</strong>'ini (URL dagi nomini) kiriting.</li>
            <li>Tizimda sizga ochilgan <strong>Login</strong> va <strong>Parol</strong>ni kiriting.</li>
            <li>Siz muvaffaqiyatli ulandingiz! Endi bildirishnomalar kelishni boshlaydi.</li>
          </ol>
        </div>

        <div className="bg-slate-100 p-4 rounded-xl">
           <h4 className="font-bold text-slate-800">Qo'shimcha Komandalar:</h4>
           <ul className="mt-2 space-y-2 text-sm">
             <li><code className="bg-white px-2 py-1 rounded text-orange-600 font-mono">/update</code> - Botni eng so'nggi versiyaga yangilash (agar qotib qolsa).</li>
             <li><code className="bg-white px-2 py-1 rounded text-orange-600 font-mono">/reset</code> - Xotirani butunlay tozalab, boshqatdan tizimga kirish.</li>
             <li><code className="bg-white px-2 py-1 rounded text-orange-600 font-mono">/logout</code> - Faqat o'z akkauntingizdan chiqish.</li>
           </ul>
        </div>
      </div>
    )
  },

  // ============ YANGI XUSUSIYATLAR ============

  {
    id: 'filiallar-bolimlar',
    icon: <Building2 size={18} />,
    title: "Filiallar va Bo'limlar (Multi-Branch)",
    tags: ['filial', 'branch', 'bolim', 'department', 'multi', 'kross-filial'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Filiallar va Bo'limlar</h1>
        <p className="text-slate-600 leading-relaxed">PrintFlow ko'p filiallikni qo'llab-quvvatlaydi. Har filialning o'z xizmatlari, xodimlari, mijozlari va xarajatlari ajratilgan (strict isolation).</p>

        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 my-6">
          <h3 className="font-bold text-cyan-900 mb-2">Filial qo'shish:</h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-cyan-900/80">
            <li>Chap menyu → <strong>Boshqaruv</strong> → <strong>Filiallar</strong>.</li>
            <li><strong>"+ Yangi filial"</strong> tugmasi → nomi, manzil, telefon, mas'ul xodimni belgilang.</li>
            <li>Har register qilingan tenantda "Bosh Ofis (Asosiy)" filial avtomatik mavjud.</li>
          </ol>
        </div>

        <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-4 my-6">
          <h3 className="font-bold text-fuchsia-900 mb-2">Bo'lim (Department) qo'shish:</h3>
          <p className="text-sm text-fuchsia-900/80 mb-2">Bo'lim — analitik teg. Buyurtma va tranzaksiyani qaysi bo'lim hisobiga yozish uchun ishlatiladi (Bosma, Dizayn, Yetkazib berish va h.k.).</p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-fuchsia-900/80">
            <li>Filiallar sahifasida har filial kartasining pastida <strong>"Bo'limlar"</strong> bo'limini oching.</li>
            <li>Yangi bo'lim nomini yozing → <strong>"Qo'shish"</strong>.</li>
            <li>Buyurtma yaratganda yoki Kassa'da tranzaksiya yozayotganda <strong>bo'lim dropdown</strong>'idan tanlang.</li>
            <li>Hisobotlarda <strong>"Bo'limga guruhlash"</strong> tugmasi orqali bo'limlar bo'yicha taqsimotni ko'ring.</li>
          </ol>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-sm">
          <p className="font-bold">Strict isolation:</p>
          <p className="mt-1">Filial A xodimi B filiali xizmatlarini, hamkorlarini ko'rmaydi. Hisobotlar ham faqat aktiv filial ma'lumotlarini ko'rsatadi (Navbar'dan filial almashish mumkin).</p>
        </div>
      </div>
    )
  },

  {
    id: 'lavozim-yaratish',
    icon: <ShieldCheck size={18} />,
    title: "Lavozim (Role) yaratish va Ruxsatlarni boshqarish",
    tags: ['lavozim', 'role', 'ruxsat', 'permission', 'admin', 'menejer'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Lavozim yaratish</h1>
        <p className="text-slate-600 leading-relaxed">Xodim yaratishdan oldin lavozim (rol) yarating. Lavozim ruxsatlari aniqlaydi: xodim qaysi sahifaga kira oladi, nima ko'ra oladi, nima qila oladi.</p>

        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 my-6">
          <h3 className="font-bold text-rose-900 mb-2">Lavozim qo'shish tartibi:</h3>
          <ol className="list-decimal pl-5 space-y-3 text-rose-900/80 text-sm">
            <li>Sozlamalar → <strong>Lavozimlar & Ruxsatlar</strong> qismi.</li>
            <li><strong>"+ Yangi Lavozim"</strong> tugmasi.</li>
            <li>Lavozim nomi (Operator, Menejer, Dizayner, Buxgalter va h.k.).</li>
            <li>Filial — qaysi filialda ushbu lavozim ishlatiladi.</li>
            <li>Ruxsatlar — checkbox'lar <strong>sahifa tartibida</strong> guruhlangan:
              <ul className="list-disc pl-5 mt-1 text-xs">
                <li>1. Kassa</li>
                <li>2. Xizmatlar (Kanban)</li>
                <li>3. Xizmatlar katalogi</li>
                <li>4. Mijozlar Bazasi</li>
                <li>5. Ombor</li>
                <li>... va shu tartibda 15 ta guruh</li>
              </ul>
            </li>
            <li>Har checkbox ustiga hover qilsangiz, "nima ko'rinadi va nima qila oladi" — detail tooltip chiqadi.</li>
          </ol>
        </div>

        <div className="bg-slate-100 p-4 rounded-xl text-sm">
          <p className="font-bold text-slate-800">Ruxsat strukturasi:</p>
          <ul className="mt-2 space-y-1 text-slate-700">
            <li>• <strong>canView*</strong> — sahifani ko'rish (read-only).</li>
            <li>• <strong>canAdd*</strong> — yangi element qo'shish.</li>
            <li>• <strong>canEdit*</strong> — mavjudni tahrirlash.</li>
            <li>• <strong>canDelete*</strong> — o'chirish.</li>
            <li>• <strong>canManage*</strong> — to'liq boshqaruv (CRUD + qo'shimcha).</li>
          </ul>
        </div>
      </div>
    )
  },

  {
    id: 'hisobotlar',
    icon: <BarChart3 size={18} />,
    title: "Hisobotlar va Tahlil",
    tags: ['hisobot', 'report', 'tahlil', 'grafik', 'kpi', 'foyda'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Hisobotlar sahifasi</h1>
        <p className="text-slate-600 leading-relaxed">Biznesingiz haqida chuqur tahlil: o'sish ko'rsatkichlari, moliyaviy dinamika, xizmat reytingi, KPI va tannarx kalkulyatori.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
            <h3 className="font-bold text-orange-800 mb-2">O'sish kartochkalari</h3>
            <p className="text-xs text-orange-900/80">Bu oy daromad / yangi mijozlar / bajarilgan buyurtmalar — o'tgan oy bilan foizli taqqoslash.</p>
          </div>
          <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl">
            <h3 className="font-bold text-sky-800 mb-2">Moliyaviy Dinamika</h3>
            <p className="text-xs text-sky-900/80">Kunlik (1 oy) yoki oylik (3-12 oy) trend grafiklari. Kirim/chiqim/hamkor/sof foyda chiziqlari.</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <h3 className="font-bold text-emerald-800 mb-2">Kirim/Chiqim Turlari</h3>
            <p className="text-xs text-emerald-900/80">To'lov usullari (Naqd, Karta, Click) va xarajat kategoriyalari bo'yicha pie chart.</p>
          </div>
          <div className="bg-violet-50 border border-violet-100 p-4 rounded-xl">
            <h3 className="font-bold text-violet-800 mb-2">Tannarx Kalkulyatori</h3>
            <p className="text-xs text-violet-900/80">Buyurtma ID bilan qidirish → xarajat qatorlari → 1 dona tannarx va marja foizi.</p>
          </div>
        </div>

        <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-4 text-sm">
          <p className="font-bold text-fuchsia-900">Yangi: Bo'limga guruhlash</p>
          <p className="mt-1 text-fuchsia-900/80">Hisobotlar tepasidagi <strong>"Bo'limga guruhlash"</strong> tugmasi orqali har bo'lim bo'yicha buyurtmalar soni va daromadi taqsimotini ko'ring.</p>
        </div>
      </div>
    )
  },

  {
    id: 'davomat',
    icon: <QrCode size={18} />,
    title: "Davomat — QR kod orqali keldi/ketdi",
    tags: ['davomat', 'attendance', 'qr', 'keldi', 'ketdi', 'overtime'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Davomat boshqaruvi</h1>
        <p className="text-slate-600 leading-relaxed">Xodimlar QR kod yoki "Keldim" tugmasi orqali kelish/ketish vaqtini belgilaydi. Admin barchasini bir joyda ko'radi.</p>

        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 my-6">
          <h3 className="font-bold text-teal-900 mb-2">Xodim uchun:</h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-teal-900/80">
            <li><strong>Davomat</strong> sahifasiga kiring.</li>
            <li>"Keldim" tugmasini bosing — joriy vaqt avtomatik yoziladi.</li>
            <li>Ish kuni oxirida "Ketdim" tugmasini bosing.</li>
            <li>Kech qolgan bo'lsangiz Telegram bot orqali sabab yuborish mumkin (Overtime so'rovi).</li>
          </ol>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 my-6">
          <h3 className="font-bold text-orange-900 mb-2">Admin uchun:</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm text-orange-900/80">
            <li>Barcha xodimlar kunlik jadvali.</li>
            <li>Oylik matritsa ko'rinishi.</li>
            <li>Qo'lda davomat kiritish (qurilmasiz xodim uchun).</li>
            <li>Ofis Wi-Fi IP allowlist sozlamasi (anti-cheat).</li>
            <li>Overtime so'rovlarini tasdiqlash/rad etish.</li>
          </ul>
        </div>
      </div>
    )
  },

  {
    id: 'ai-copilot',
    icon: <Bot size={18} />,
    title: "AI Copilot — Avtomatik yordamchi",
    tags: ['ai', 'copilot', 'yordamchi', 'avtomatik', 'chatbot'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">AI Copilot</h1>
        <p className="text-slate-600 leading-relaxed">AI yordamchi orqali tabiiy tildan buyurtma yarating, xizmat qo'shing yoki tizim haqida savol bering.</p>

        <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 rounded-xl p-4 my-6">
          <h3 className="font-bold text-violet-900 mb-3">Misol dialoglar:</h3>
          <div className="space-y-3 text-sm">
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-slate-700"><strong>Siz:</strong> "Sardor uchun Banner Bosma buyurtma yarat, 500 ming zakolat, Bosma bo'limiga"</p>
              <p className="text-violet-700 mt-1"><strong>AI:</strong> "Tushundim. Tasdiqlaysizmi? Buyurtma: Sardor — Banner Bosma, Zakolat: 500 000, Bo'lim: Bosma..."</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-slate-700"><strong>Siz:</strong> "Yangi xizmat: Vizitka 100x60, 30000 narx, dona birlik"</p>
              <p className="text-violet-700 mt-1"><strong>AI:</strong> "Yaratdim. ID: xxx — endi katalogda ko'rinadi."</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-100 p-4 rounded-xl text-sm">
          <p className="font-bold text-slate-800">Ochish:</p>
          <p className="mt-1 text-slate-700">Sahifa pastida AI ikonkasi yoki Ctrl+/ bosing. AI sizning kontekstingizdan kelib chiqib javob beradi (xodimlar, mijozlar, xizmatlar bilim bazasi bilan).</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-sm">
          <p className="font-bold">Eslatma:</p>
          <p className="mt-1">AI Copilot Super Admin tomonidan yoqilgan bo'lishi kerak. Agar ko'rinmasa, "Faol emas" deganidir.</p>
        </div>
      </div>
    )
  },

  {
    id: 'command-palette',
    icon: <Command size={18} />,
    title: "Ctrl+K — Tezkor qidiruv",
    tags: ['ctrl', 'k', 'cmd', 'qidiruv', 'navigatsiya', 'tezkor', 'command'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Command Palette</h1>
        <p className="text-slate-600 leading-relaxed">Klaviatura orqali istalgan sahifaga 2 ta bosish bilan o'tish.</p>

        <div className="bg-slate-900 text-white rounded-xl p-6 my-6 text-center">
          <div className="text-3xl font-bold mb-3">
            <kbd className="bg-slate-700 px-3 py-1 rounded text-orange-400">Ctrl</kbd>
            <span className="mx-2 text-slate-500">+</span>
            <kbd className="bg-slate-700 px-3 py-1 rounded text-orange-400">K</kbd>
          </div>
          <p className="text-sm text-slate-400">(Mac: <kbd className="bg-slate-700 px-2 py-0.5 rounded text-orange-400">⌘</kbd> + <kbd className="bg-slate-700 px-2 py-0.5 rounded text-orange-400">K</kbd>)</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h3 className="font-bold text-slate-800 mb-2">Ishlatish:</h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
            <li>Istalgan sahifada <strong>Ctrl+K</strong> bosing.</li>
            <li>Sahifa nomini yozing: <em>"kassa"</em>, <em>"buyurtma"</em>, <em>"hodim"</em>...</li>
            <li><strong>↑↓</strong> klavishlari bilan tanlang.</li>
            <li><strong>Enter</strong> — shu sahifaga o'tasiz.</li>
            <li><strong>Esc</strong> — yopish.</li>
          </ol>
        </div>
      </div>
    )
  },

  {
    id: 'onboarding-tour',
    icon: <Sparkles size={18} />,
    title: "Onboarding Tour — Interaktiv yo'l-yo'riq",
    tags: ['onboarding', 'tour', 'tutorial', 'yangi', 'qollanma'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Interaktiv Tour</h1>
        <p className="text-slate-600 leading-relaxed">Yangi register qilgan foydalanuvchi uchun 8 qadamli tour. O'yin tutorial uslubida: spotlight + tooltip + avtomatik navigatsiya.</p>

        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 my-6">
          <h3 className="font-bold text-orange-900 mb-3">Tour tartibi:</h3>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-orange-900/80">
            <li>🎉 Welcome — tizimga xush kelibsiz</li>
            <li>1️⃣ <strong>Filial</strong> sozlash</li>
            <li>2️⃣ <strong>Lavozim</strong> yaratish (ruxsatlar)</li>
            <li>3️⃣ <strong>To'lov turlari</strong> (Naqd, Karta...)</li>
            <li>4️⃣ <strong>Xizmatlar katalogi</strong></li>
            <li>5️⃣ <strong>Birinchi xodim</strong></li>
            <li>6️⃣ <strong>Kanban ustunlari</strong> (Yangi → Tayyor)</li>
            <li>✅ Tugadi — biznesni boshqarish mumkin</li>
          </ol>
        </div>

        <div className="bg-slate-100 p-4 rounded-xl text-sm">
          <p className="font-bold text-slate-800">Qaytadan ishga tushirish:</p>
          <p className="mt-1 text-slate-700">Ushbu sahifaning chap yon panelida <strong>"Yo'l-yo'riqni qaytadan ko'rish"</strong> apelsin tugmasi mavjud — bosing va tour qaytadan boshlanadi.</p>
        </div>
      </div>
    )
  }
];

export default function Qollanma() {
  const [search, setSearch] = useState('');
  const [activeGuide, setActiveGuide] = useState(GUIDES[0].id);

  // Qidiruv mantiqasi
  const filteredGuides = useMemo(() => {
    if (!search.trim()) return GUIDES;
    const q = search.toLowerCase();
    return GUIDES.filter(g => 
      g.title.toLowerCase().includes(q) || 
      g.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [search]);

  // Avtomatik birinchi chiqqan natijani tanlash
  React.useEffect(() => {
    if (search.trim() && filteredGuides.length > 0) {
      if (!filteredGuides.find(g => g.id === activeGuide)) {
        setActiveGuide(filteredGuides[0].id);
      }
    }
  }, [search, filteredGuides, activeGuide]);

  const activeContent = useMemo(() => {
    return GUIDES.find(g => g.id === activeGuide)?.content;
  }, [activeGuide]);

  return (
    <div className="h-full bg-white text-slate-900 font-sans selection:bg-orange-100 flex flex-col md:flex-row rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      
      {/* Sidebar - Navigation */}
      <aside className="w-full md:w-80 border-r border-slate-100 bg-slate-50/50 flex flex-col h-full sticky top-0">
        <div className="p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3 text-[#FF6B00] mb-6">
            <div className="bg-[#FF6B00]/10 p-2 rounded-xl">
              <Book size={24} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold tracking-tight text-xl text-slate-800">Qo'llanma</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Yordam Markazi</p>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#FF6B00]" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qanday amal qidiryapsiz? (Masalan: xizmat)"
              className="w-full bg-slate-100/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] transition-all"
            />
          </div>

          {/* Tourni qaytadan ishga tushirish */}
          <button
            onClick={() => {
              // Tur tenant ID'sini topish — sessionStorage'dagi user info'dan
              try {
                const raw = sessionStorage.getItem('pf_user_info');
                if (raw) {
                  const user = JSON.parse(raw);
                  if (user?.tenantId) {
                    localStorage.removeItem(`pf_tour_${user.tenantId}`);
                    localStorage.removeItem(`pf_onboarded_${user.tenantId}`);
                  }
                }
              } catch {}
              window.location.href = '/dashboard';
            }}
            className="w-full mt-3 flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-widest transition-colors shadow-md shadow-orange-500/20"
          >
            <PlayCircle size={14} /> Yo'l-yo'riqni qaytadan ko'rish
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-3 mb-3">Mavzular ({filteredGuides.length})</p>
          {filteredGuides.length > 0 ? (
            filteredGuides.map(guide => (
              <button
                key={guide.id}
                onClick={() => setActiveGuide(guide.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left ${
                  activeGuide === guide.id 
                    ? 'bg-orange-50 text-orange-700 font-bold' 
                    : 'text-slate-600 hover:bg-slate-100 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${activeGuide === guide.id ? 'text-orange-500' : 'text-slate-400'}`}>
                    {guide.icon}
                  </span>
                  <span className="text-sm truncate pr-2">{guide.title}</span>
                </div>
                {activeGuide === guide.id && <ChevronRight size={14} className="text-orange-400" />}
              </button>
            ))
          ) : (
            <div className="text-center p-6 text-slate-400">
              <FileText size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm font-bold">Hech narsa topilmadi</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl p-8 md:p-12 lg:p-16 overflow-y-auto">
        {activeContent}
        
        {/* Footer info inside content */}
        <div className="mt-20 pt-8 border-t border-slate-100 flex items-center justify-between text-slate-400">
          <p className="text-xs font-medium">PrintFlow Docs &copy; {new Date().getFullYear()}</p>
          <div className="flex gap-4">
            <span className="text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-[#FF6B00] transition-colors">Yordam so'rash</span>
          </div>
        </div>
      </main>

    </div>
  );
}
