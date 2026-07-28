// =============================================
// Qo'llanma bilim bazasi (KB) — AI shu yerdan javob beradi.
//
// Maqsad: "xodim qayerdan qo'shaman?" kabi TIZIM savollariga AI tizimni
// research qilmasdan, to'g'ridan-to'g'ri qo'llanmadan javob bersin.
// Bu ikki foyda beradi: (1) javob har doim bir xil va to'g'ri, (2) mos
// kelganda LLM umuman chaqirilmaydi — o'sha so'rov xarajati nol.
//
// Bu fayl frontend'dagi `pages/Qollanma.tsx` bilan MAZMUNAN bir xil bo'lishi
// kerak. Qo'llanmaga yangi bo'lim qo'shilsa — shu yerga ham entry qo'shiladi.
// =============================================

export interface KbEntry {
  id: string;
  /** Qisqa sarlavha — indeksda va javob boshida ishlatiladi. */
  title: string;
  /** Qaysi sahifada bajariladi (navigatsiya uchun). */
  page: string;
  /**
   * MAVZU so'zlari — "gap nima haqida" ni aniqlaydi (xodim, buyurtma, ombor...).
   * Kamida bittasi mos kelmasa, yozuv umuman nomzod bo'lolmaydi.
   */
  topics: string[];
  /**
   * AMAL so'zlari — bir xil mavzudagi yozuvlarni ajratadi
   * ("xodim QO'SHISH" va "xodim TAHRIRLASH" ni farqlaydi).
   */
  actions: string[];
  /** Suhbat uslubidagi tayyor javob — markdown YO'Q, o'zbek lotin. */
  answer: string;
}

export const GUIDE_KB: KbEntry[] = [
  {
    id: 'xodim-qoshish',
    title: "Xodim qo'shish",
    page: 'Xodimlar',
    topics: ['xodim', 'hodim', 'ishchi', 'kadr'],
    actions: ['qosh', 'yarat', 'kirit', 'royxatga ol', 'login', 'parol ber'],
    answer:
      "Chap menyudan Xodimlar sahifasiga o'ting va \"+ Yangi Xodim\" tugmasini bosing. " +
      "Ism-familiya, telefon, lavozim va filialni tanlaysiz, maoshni ham shu yerda kiritasiz. " +
      "Saqlaganingizda tizim login va parolni avtomatik yaratadi va ekranda ko'rsatadi — o'sha ma'lumotni xodimga uzatasiz. " +
      "Agar kerakli lavozim yo'q bo'lsa, avval Sozlamalar → Lavozimlar bo'limidan yarating.",
  },
  {
    id: 'xodim-tahrirlash',
    title: "Xodim ma'lumotlarini tahrirlash",
    page: 'Xodimlar',
    topics: ['xodim', 'hodim', 'ishchi', 'maosh', 'oylik'],
    actions: ['tahrir', 'ozgart', 'uzgart', 'togrila', 'yangila malumot'],
    answer:
      "Xodimlar sahifasida kerakli xodim qatoriga sichqonchani olib boring — o'ng tomonda qalam belgisi chiqadi, shuni bosing. " +
      "Ochilgan oynada ism-familiya, telefon, lavozim, filial va maoshni o'zgartirib \"Saqlash\" bosasiz. " +
      "Login va parol u yerda o'zgarmaydi: parolni yangilash uchun o'sha qatordagi aylanma strelka tugmasidan foydalaning.",
  },
  {
    id: 'xodim-parol',
    title: 'Xodim parolini yangilash',
    page: 'Xodimlar',
    topics: ['parol', 'password'],
    actions: ['yangila', 'tikla', 'unut', 'ozgart', 'qayta'],
    answer:
      "Xodimlar sahifasida xodim qatoridagi aylanma strelka (yangilash) tugmasini bosing — tizim yangi parol yaratadi va ekranda ko'rsatadi. " +
      "Parol yangilanganda xodim barcha qurilmalardan avtomatik chiqariladi, shuning uchun yangi parolni darhol unga yetkazing.",
  },
  {
    id: 'lavozim-yaratish',
    title: 'Lavozim va ruxsatlar',
    page: 'Sozlamalar → Lavozimlar & Ruxsatlar',
    topics: ['lavozim', 'rol', 'ruxsat', 'huquq', 'permission'],
    actions: ['yarat', 'qosh', 'berish', 'beraman', 'sozla', 'ozgart', 'belgil'],
    answer:
      "Sozlamalar sahifasidagi \"Lavozimlar & Ruxsatlar\" bo'limiga o'ting va \"+ Yangi Lavozim\" bosing. " +
      "Lavozim nomi va filialni kiritasiz, keyin checkbox'lar orqali ruxsatlarni belgilaysiz — ular sahifalar bo'yicha guruhlangan. " +
      "Ruxsat turlari: ko'rish, qo'shish, tahrirlash, o'chirish va to'liq boshqaruv. Har checkbox ustiga sichqonchani olib borsangiz izoh chiqadi.",
  },
  {
    id: 'ai-ruxsat',
    title: 'AI yordamchi nega ko\'rinmayapti',
    page: 'Sozlamalar → Billing',
    topics: ['ai', 'copilot', 'canuseai'],
    actions: ['yoqish', 'yoqaman', 'yoqib', 'ruxsat', 'huquq', 'kimga', 'korinmayapti', 'ishlamayapti'],
    answer:
      "AI yordamchini lavozim darajasida yoqish kerak emas — u butunlay platforma ma'muriyati nazoratida. " +
      "Chat ko'rinishi uchun ikki shart bajarilishi kerak: platformada AI global yoqilgan bo'lishi va workspace tarifida \"ai_chat\" moduli bo'lishi. " +
      "Ikkinchisi ko'pincha sabab bo'ladi: tarif biriktirilmagan yoki tarifda AI moduli yo'q workspace'da chat umuman chiqmaydi. " +
      "Tarifingizni Sozlamalar → Billing bo'limidan ko'rasiz; o'zgartirish uchun platforma ma'muriyatiga murojaat qiling.",
  },
  {
    id: 'buyurtma-qoshish',
    title: "Buyurtma qo'shish",
    page: 'Xizmatlar (Kanban)',
    topics: ['buyurtma', 'zakaz'],
    actions: ['qosh', 'yarat', 'kirit', 'ochish', 'ochaman', 'ochamiz', 'ochiladi'],
    answer:
      "Xizmatlar (Kanban) sahifasiga o'ting va \"+ Yangi buyurtma\" tugmasini bosing. " +
      "Mijozni tanlang yoki yangi mijoz kiriting, xizmat va sonini belgilang, jami summa bilan zakolatni yozing, to'lov turi va muddatni tanlang. " +
      "Saqlagandan keyin buyurtma birinchi ustunda paydo bo'ladi — uni sudrab keyingi bosqichga o'tkazasiz.",
  },
  {
    id: 'xizmat-qoshish',
    title: 'Xizmat (katalog) qo\'shish',
    page: 'Xizmatlar katalogi',
    topics: ['xizmat', 'katalog', 'mahsulot', 'narx'],
    actions: ['qosh', 'yarat', 'belgil', 'kirit', 'optsiya'],
    answer:
      "Xizmatlar katalogi bo'limida \"+ Yangi xizmat\" tugmasini bosing. " +
      "Nom, asosiy narx va o'lchov birligini (dona, metr, m2) kiritasiz. " +
      "Keyin xizmatga optsiyalar qo'shishingiz mumkin — masalan qog'oz turi yoki o'lcham — har biriga qo'shimcha narx belgilanadi va buyurtmada avtomatik hisoblanadi.",
  },
  {
    id: 'narx-royxati',
    title: "Narxlar ro'yxati va buyurtma taklifi",
    page: "Sozlamalar → Narxlar ro'yxati",
    topics: ['narx royxat', 'pricelist', 'price list', 'taklif', 'kommercheskiy'],
    actions: ['tayyorla', 'yubor', 'yukla', 'qidir', 'topish', 'topaman', 'tuzish', 'ochish', 'ochaman', 'ochiladi'],
    answer:
      "Sozlamalar sahifasidagi \"Narxlar ro'yxati\" bo'limidan ochasiz. " +
      "Ikkita rejim bor: bosma narxlar varag'i va buyurtma taklifi. " +
      "Buyurtma taklifida yuqoridagi qidiruv maydoniga mahsulot nomini yozib tez topasiz, sonini kiritib \"Qo'shish\" bosasiz, o'ngdagi savatda jami summa avtomatik hisoblanadi. " +
      "Tayyor bo'lgach PDF yoki PNG ko'rinishida yuklab olib mijozga yuborasiz.",
  },
  {
    id: 'mijoz-qarz',
    title: 'Mijozlar va qarzdorlar',
    page: 'Mijozlar',
    topics: ['mijoz', 'crm', 'qarzdor', 'qarz'],
    actions: ['qosh', 'yarat', 'kirit', 'korish', 'koraman', 'kuzat', 'boshqar'],
    answer:
      "Mijozlar sahifasida \"+ Yangi mijoz\" orqali mijoz qo'shasiz — ism, telefon va manzil yetarli. " +
      "Qarz avtomatik hisoblanadi: buyurtma summasidan to'langan qismini ayirib boradi. " +
      "Qarzdorlarni ko'rish uchun shu sahifadagi qarz bo'yicha saralashdan foydalaning, umumiy holat esa Dashboard'dagi qarzdorlar kartasida turadi.",
  },
  {
    id: 'kassa',
    title: 'Kassa — kirim va chiqim',
    page: 'Kassa',
    topics: ['kassa', 'kirim', 'chiqim', 'tranzaksiya'],
    actions: ['qosh', 'kirit', 'yozish', 'yozaman', 'qabul', 'yarat'],
    answer:
      "Kassa sahifasida \"Kirim\" yoki \"Chiqim\" tugmasini bosasiz, summani, to'lov turini va izohni kiritasiz. " +
      "Buyurtmadan tushgan to'lovlar avtomatik yoziladi, qo'lda faqat qo'shimcha kirim-chiqimlarni kiritasiz. " +
      "Kunlik va oylik yakun shu sahifaning yuqorisida, batafsil tahlil esa Hisobotlar bo'limida.",
  },
  {
    id: 'hisobot',
    title: 'Hisobotlar va tahlil',
    page: 'Hisobotlar',
    topics: ['hisobot', 'tahlil', 'eksport', 'excel', 'xlsx'],
    actions: ['olish', 'olaman', 'yukla', 'chiqar', 'korish', 'koraman', 'tayyorla'],
    answer:
      "Hisobotlar sahifasida davrni tanlaysiz va kerakli kesimni ko'rasiz: tushum, xarajat, foyda, xizmatlar bo'yicha taqsimot. " +
      "Yuqoridagi yuklab olish tugmasi orqali Excel (xlsx) ko'rinishida eksport qilasiz — summalar haqiqiy son hujayrasi bo'lib tushadi, ya'ni Excel'da darhol hisoblash mumkin.",
  },
  {
    id: 'ombor',
    title: 'Ombor va materiallar',
    page: 'Ombor',
    topics: ['ombor', 'material', 'zaxira', 'sklad', 'qoldiq'],
    actions: ['qosh', 'kirit', 'yarat', 'kuzat', 'qoldiq'],
    answer:
      "Ombor sahifasida material qo'shasiz: nom, o'lchov birligi, joriy qoldiq va minimal chegara. " +
      "Qoldiq minimal chegaradan pastga tushsa tizim ogohlantiradi va Dashboard'dagi ombor kartasida ko'rinadi. " +
      "Buyurtma bajarilganda sarflangan material qoldiqdan avtomatik ayriladi.",
  },
  {
    id: 'davomat',
    title: 'Davomat (keldi-ketdi)',
    page: 'Davomat',
    topics: ['davomat', 'attendance', 'keldim', 'ketdim', 'qr kod', 'ish vaqti'],
    actions: ['belgil', 'kirit', 'yozish', 'yozaman', 'kuzat', 'tasdiq', 'sozla'],
    answer:
      "Xodim Davomat sahifasida \"Keldim\" tugmasini bosadi, ish oxirida \"Ketdim\" bosadi — vaqt avtomatik yoziladi. QR kod orqali ham belgilash mumkin. " +
      "Admin uchun shu sahifada kunlik jadval, oylik matritsa, qo'lda davomat kiritish va kechikish sabablarini tasdiqlash bor. " +
      "Ofis Wi-Fi IP cheklovini yoqib qo'ysangiz, xodim faqat ish joyidan belgilay oladi.",
  },
  {
    id: 'filial-bolim',
    title: "Filial va bo'limlar",
    page: "Ma'muriyat → Filiallar",
    topics: ['filial', 'bolim', 'department', 'sex'],
    actions: ['qosh', 'yarat', 'ochish', 'sozla', 'biriktir'],
    answer:
      "Ma'muriyat bo'limidagi Filiallar qismidan yangi filial qo'shasiz — nom, manzil va telefon. " +
      "Har filial ichida bo'limlar (masalan Bosma, Dizayn, Montaj) yaratiladi, buyurtma yaratayotganda o'sha bo'limga yo'naltirasiz. " +
      "Xodimni ham aynan filialga biriktirasiz, shunda hisobotlar filial kesimida ajraladi.",
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    page: 'Dashboard',
    topics: ['dashboard', 'bosh sahifa', 'bosh saxifa', 'widget', 'vidjet'],
    actions: ['sozla', 'ochish', 'ochaman', 'yoqish', 'yashir', 'tanla', 'korish', 'ishla', 'nima'],
    answer:
      "Dashboard — tizimning umumiy manzarasi: moliya holati, buyurtmalar, davomat, qarzdor mijozlar, ombor qoldig'i, hamkorlar va xodimlar bo'yicha kartalar va grafiklar bir joyda. " +
      "Yuqoridagi sozlash tugmasi orqali qaysi kartalar ko'rinishini o'zingiz tanlaysiz — tanlov shu brauzerda saqlanadi. " +
      "Har karta o'z ruxsatiga bog'liq: xodim faqat ko'rish huquqi bor bo'limlarni ko'radi.",
  },
  {
    id: 'ai-xavf',
    title: 'AI xavf nazorati',
    page: 'Dashboard',
    topics: ['xavf', 'ogohlantirish', 'risk', 'ai nazorat'],
    actions: ['bartaraf', 'yopish', 'korish', 'ishla', 'aniqla', 'nima'],
    answer:
      "AI butun tizimni fonda kuzatib boradi va modullarni o'zaro solishtiradi — masalan bugun topshiriladigan buyurtma bor-u, unga biriktirilgan xodim ishga kelmagan bo'lsa, yoki qarzdor mijozga yana yangi buyurtma ochilgan bo'lsa, Dashboard'da xavf kartasi chiqadi. " +
      "Kartadagi \"Bartaraf etish\" tugmasini bossangiz AI suhbati tayyor so'rov bilan ochiladi va yechimni o'zi bajarib beradi. " +
      "Muammo o'z-o'zidan hal bo'lsa karta avtomatik yopiladi, keraksizini esa \"Yopish\" bilan olib tashlaysiz.",
  },
  {
    id: 'ai-limit',
    title: "AI so'rov limiti va qo'shimcha paket",
    page: 'Sozlamalar → Billing',
    topics: ['ai limit', 'sorov limit', 'limit', 'kredit', 'paket'],
    actions: ['tugadi', 'sotib olish', 'sotib olaman', 'qosh', 'oshir', 'tikla', 'korish'],
    answer:
      "Har bir tarifda kunlik va oylik AI so'rov limiti bor — qolgan miqdorni chat oynasining yuqorisidagi indikatorda ko'rasiz. " +
      "Limit tugasa kunlik hisob yarim tunda tiklanadi, kutmoqchi bo'lmasangiz Sozlamalar → Billing bo'limidan qo'shimcha so'rov paketi sotib olasiz. " +
      "To'lov chekini yuklaysiz, admin tasdiqlagach kreditlar hisobingizga qo'shiladi va limitdan tashqari ishlatiladi. " +
      "Muhim: AI fonda o'zi bajaradigan nazorat ishlari bu limitdan hisoblanmaydi.",
  },
  {
    id: 'ai-copilot',
    title: 'AI yordamchi bilan ishlash',
    page: 'Istalgan sahifa',
    topics: ['ai', 'copilot', 'yordamchi', 'girgitton', 'chat'],
    actions: ['ochish', 'ochaman', 'ishlat', 'gaplash', 'yopish', 'sorayman'],
    answer:
      "AI yordamchini o'ng yuqoridagi ikonka yoki Ctrl + / orqali ochasiz. U sahifaning o'ng tomonida ochiladi va sahifa mazmunini bosib qolmaydi, shuning uchun ishlab turib ochiq qoldirsangiz ham bo'ladi. " +
      "Tabiiy tilda yozasiz: buyurtma yaratish, xizmat qo'shish, qarzdorlar hisobotini olish kabi ishlarni o'zi bajaradi. " +
      "Ma'lumotni o'zgartiradigan amallarda avval tasdiq kartasi chiqadi — siz tasdiqlamaguningizcha hech narsa yozilmaydi.",
  },
  {
    id: 'telegram-bot',
    title: 'Telegram botni ulash',
    page: 'Sozlamalar → Integratsiyalar',
    topics: ['telegram', 'bot'],
    actions: ['ulash', 'ulayman', 'bogla', 'sozla', 'token', 'ochish'],
    answer:
      "Sozlamalar → Integratsiyalar bo'limida Telegram bot tokenini kiritasiz va saqlaysiz. " +
      "Keyin har bir xodim botga o'z login-paroli bilan bir marta kiradi va hisobi bog'lanadi. " +
      "Shundan keyin bot buyurtma o'zgarishlari va davomat haqida xabar yuboradi.",
  },
  {
    id: 'tezkor-qidiruv',
    title: 'Tezkor qidiruv',
    page: 'Istalgan sahifa',
    topics: ['ctrl k', 'tezkor qidiruv', 'command palette'],
    actions: ['ochish', 'ochaman', 'ishlat', 'topish', 'nima'],
    answer:
      "Ctrl + K bosing — tezkor qidiruv oynasi ochiladi. " +
      "Sahifa nomi, mijoz, buyurtma yoki xizmat nomini yozib to'g'ridan-to'g'ri o'sha joyga o'tasiz. " +
      "Shu yerdan AI'ga savol ham yuborish mumkin.",
  },

  // ── Maosh ──────────────────────────────────────────────────────────
  {
    id: 'maosh-hisob',
    title: 'Maosh — oylik hisob-kitob',
    page: 'Xodimlar → Maosh',
    topics: ['maosh', 'oylik', 'payroll', 'ish haqi'],
    actions: ['hisoblash', 'hisoblayman', 'tola', 'berish', 'beraman', 'yopish', 'chiqar', 'korish'],
    answer:
      "Xodimlar sahifasidagi \"Maosh\" tabini oching va yuqoridan oyni tanlang. " +
      "Har xodim qatorida fiksa, bonus va jarima ustunlari bor — ularni to'g'ridan-to'g'ri jadvalda tahrirlaysiz. " +
      "Sof maosh = fiksa + bonus − jarima; berish kerak = sof maosh − shu oy avansi − oldingi qarz. " +
      "\"To'lash\" bosilganda Kassadan chiqim yoziladi. Xato bo'lsa \"Bekor qilish\" bilan qaytarasiz.",
  },
  {
    id: 'maosh-sxema',
    title: 'Maosh sxemasi (avtomatik hisob)',
    page: 'Xodimlar → Maosh sxemasi',
    topics: ['sxema', 'maosh sxema', 'kpi'],
    actions: ['sozla', 'belgil', 'yarat', 'qosh', 'ozgart', 'ishla'],
    answer:
      "Xodimlar sahifasidagi \"Maosh sxemasi\" tabida lavozimni tanlaysiz, keyin \"+ To'lov turi qo'shish\" bosasiz. " +
      "Uch tur bor: Fiksa (qat'iy summa), KPI (natijaga qarab) va Jarima. Tanlagan turingiz nima so'rasa faqat shuni so'raydi. " +
      "Fiksa bir necha qismdan iborat bo'lishi mumkin — masalan 1 mln asosiy, 1 mln to'liq davomatga, 1 mln vaqtida kelishga. " +
      "Har qatorga shart qo'yiladi (\"ish kunlari kamida 22\"). Sxema belgilangan lavozimda maosh avtomatik hisoblanadi, " +
      "belgilanmaganida avvalgidek qo'lda yoziladi.",
  },
  {
    id: 'maosh-metrika',
    title: 'KPI nimaga qarab hisoblanadi',
    page: 'Xodimlar → Maosh sxemasi',
    topics: ['metrika', 'nimaga qarab', 'kpi asosi'],
    actions: ['tanla', 'belgil', 'olcha', 'nima', 'hisoblanadi', 'asosla'],
    answer:
      "KPI va jarima quyidagi o'lchovlardan biriga bog'lanadi: ish kunlari, ish soatlari, kechikish daqiqasi, " +
      "qo'shimcha ish daqiqasi, bajarilgan buyurtmalar soni, ularning summasi, miqdori (dona) va xodim orqali tushgan kirim. " +
      "Bir buyurtmada bir necha xodim ishlagan bo'lsa — har biriga to'liq yoziladi, bo'linmaydi. " +
      "Buyurtma \"bajarildi\" ustuniga ko'chirilgan payt hisobga olinadi.",
  },
  {
    id: 'avans',
    title: 'Avans berish',
    page: 'Kassa',
    topics: ['avans'],
    actions: ['berish', 'beraman', 'ushla', 'yozish', 'yozaman', 'kirit'],
    answer:
      "Avans Kassadan chiqim sifatida yoziladi va xodim tanlanadi, \"maosh avansi\" belgisi qo'yiladi. " +
      "Oy yakunida u Maosh sahifasida avtomatik ushlab qolinadi. " +
      "Agar avans sof maoshdan ko'p bo'lsa, farq keyingi oyga qarz bo'lib ko'chadi.",
  },

  // ── Boshqa modullar ────────────────────────────────────────────────
  {
    id: 'hamkorlar',
    title: 'Hamkorlar (subpudratchi va yetkazuvchilar)',
    page: 'Hamkorlar',
    topics: ['hamkor', 'vendor', 'subpudrat', 'yetkazuvchi'],
    actions: ['qosh', 'yarat', 'hisob', 'korish', 'koraman', 'tola', 'kuzat'],
    answer:
      "Hamkorlar sahifasida tashqi bajaruvchilar va yetkazib beruvchilar yuritiladi. " +
      "Har hamkorda balans avtomatik hisoblanadi: ularga bergan ishlaringiz va xaridlaringiz minus to'langan summa, " +
      "ular sizdan olgan xizmatlari minus sizga to'lagani. Natijada kim kimga qarzdorligi ko'rinadi.",
  },
  {
    id: 'mamuriyat',
    title: "Ma'muriyat (rahbarlar)",
    page: "Ma'muriyat",
    topics: ['mamuriyat', 'rahbar', 'workspace admin'],
    actions: ['qosh', 'yarat', 'berish', 'boshqar', 'nima', 'kerak', 'farq'],
    answer:
      "Ma'muriyat sahifasi faqat adminlarga ochiq — bu yerda workspace darajasidagi rahbarlar boshqariladi. " +
      "Oddiy xodimlardan farqi: ular filialga bog'lanmagan va butun workspace bo'yicha huquqqa ega. " +
      "Oddiy xodim qo'shish uchun esa Xodimlar sahifasidan foydalaning.",
  },
  {
    id: 'statistika',
    title: 'Statistika va daromad tahlili',
    page: 'Statistika',
    topics: ['statistika', 'daromad', 'foyda', 'tushum'],
    actions: ['korish', 'koraman', 'tahlil', 'ochish', 'ochaman', 'kuzat'],
    answer:
      "Statistika sahifasida daromad, xarajat va foyda dinamikasi grafiklarda ko'rsatiladi. " +
      "Davrni tanlab, xizmatlar va to'lov turlari kesimida taqqoslash mumkin. " +
      "Batafsil, eksport qilinadigan hisobotlar esa Hisobotlar sahifasida.",
  },
  {
    id: 'buyurtma-tahrirlash',
    title: "Buyurtmani tahrirlash, arxivlash va o'chirish",
    page: 'Xizmatlar (Kanban)',
    topics: ['buyurtma', 'zakaz'],
    actions: ['tahrir', 'ozgart', 'ochirish', 'arxiv', 'bekor', 'togrila'],
    answer:
      "Kanban'da buyurtma kartasini bosing — tafsilot oynasi ochiladi va u yerda summa, muddat, mas'ul xodim, izohni o'zgartirasiz. " +
      "Bosqichni o'zgartirish uchun kartani kerakli ustunga sudrab olib o'tasiz; har ko'chirish tarixga yoziladi. " +
      "Tugallangan buyurtmalarni arxivlash mumkin — ular ro'yxatdan chiqadi, lekin hisobotlarda qoladi. " +
      "O'chirish esa butunlay yo'q qiladi va faqat tegishli ruxsati borlarga ochiq.",
  },
  {
    id: 'kanban-ustun',
    title: 'Kanban ustunlari (bosqichlar)',
    page: 'Xizmatlar (Kanban)',
    topics: ['ustun', 'bosqich', 'kanban'],
    actions: ['qosh', 'yarat', 'nomla', 'tartib', 'sozla', 'ozgart'],
    answer:
      "Ustunlar ish jarayonining bosqichlari — masalan Buyurtma olindi, Dizaynda, Pechatda, Topshirildi. " +
      "Kanban sahifasining yuqorisidan yangi ustun qo'shasiz, nomini o'zgartirasiz va tartibini almashtirasiz. " +
      "Muhimi: qaysi ustun \"bajarildi\" degani ekanini belgilab qo'ying — hisobotlar va maosh KPI'si aynan shunga qarab ishlaydi.",
  },
  {
    id: 'variant',
    title: "Variantlar (rang, o'lcham)",
    page: 'Xizmatlar (Kanban)',
    topics: ['variant', 'rang', 'olcham', 'razmer'],
    actions: ['qosh', 'kirit', 'belgil', 'ajrat'],
    answer:
      "Bir buyurtmada mahsulot rang yoki o'lcham bo'yicha bo'linsa, variant qatorlaridan foydalaning: " +
      "har qatorga atributlar (masalan Rang: Oq, O'lcham: M) va soni kiritiladi. " +
      "Umumiy miqdor qatorlar yig'indisidan avtomatik chiqadi — alohida yozish shart emas. " +
      "Buning uchun avval xizmat katalogida variant o'qlari (Rang, O'lcham) belgilangan bo'lishi kerak.",
  },
  {
    id: 'kassa-boks',
    title: "Kassalar va o'tkazma",
    page: 'Kassa',
    topics: ['kassa boks', 'otkazma', 'pul otkaz', 'seyf'],
    actions: ['qosh', 'otkaz', 'yarat', 'ajrat', 'kuchir'],
    answer:
      "Tizimda bir nechta kassa bo'lishi mumkin: umumiy (bosh) kassa va xodimlarga biriktirilgan shaxsiy kassalar. " +
      "Har kirim-chiqim qaysi kassaga tegishli ekani ko'rsatiladi, shuning uchun har birining qoldig'i alohida ko'rinadi. " +
      "Kassalar o'rtasida pul o'tkazish mumkin — o'tkazma ikkala tomonda ham yoziladi va umumiy balansni o'zgartirmaydi.",
  },
  {
    id: 'material-norma',
    title: 'Material normasi (bir dona uchun sarf)',
    page: 'Xizmatlar katalogi',
    topics: ['norma', 'bom', 'material sarfi', 'sarf'],
    actions: ['belgil', 'qosh', 'sozla', 'kirit'],
    answer:
      "Xizmat kartasida \"material normasi\" belgilanadi — bir dona mahsulot uchun qancha material ketishi. " +
      "Buyurtma bajarilganda o'sha miqdor ombordan avtomatik ayriladi, qo'lda yozish shart emas. " +
      "Norma belgilangan bo'lsa, tizim buyurtma uchun material yetishmasligini oldindan ogohlantiradi.",
  },
  {
    id: 'tarif-tolov',
    title: "Tarif va obuna to'lovi",
    page: 'Sozlamalar → Billing',
    topics: ['tarif', 'obuna', 'billing'],
    actions: ['tola', 'uzaytir', 'sotib ol', 'almashtir', 'korish'],
    answer:
      "Sozlamalar → Billing bo'limida joriy tarifingiz, amal qilish muddati va limitlar ko'rinadi. " +
      "Uzaytirish yoki tarifni almashtirish uchun to'lovni amalga oshirib chekni yuklaysiz, admin tasdiqlagach muddat uzayadi. " +
      "Obuna tugasa tizimga kirish cheklanadi, shuning uchun muddatni oldindan kuzatib boring.",
  },
];

// =============================================
// Normalizatsiya va qidiruv
// =============================================

/**
 * Savolni taqqoslashga tayyorlaydi: kichik harf, apostroflar olib tashlanadi
 * (o'zbek lotinida bitta so'z o' / o‘ / oʻ / o` ko'rinishida yozilishi mumkin),
 * ortiqcha belgi va bo'shliqlar tozalanadi.
 */
export function normalizeQuestion(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/['’‘`ʻʼ]/g, '')
    .replace(/[^a-zа-яё0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * O'zbek tilida qo'shimchalar so'z OXIRIGA qo'shiladi ("qo'sh" → "qo'shaman",
 * "qo'shish", "qo'shamiz"). Shuning uchun o'zak so'z tokenning boshiga to'g'ri
 * kelsa — mos deb hisoblaymiz. Teskarisi ham kerak: foydalanuvchi qisqartirib
 * yozsa ("xodim" o'rniga "xod") uzunligi yetarli bo'lsa qabul qilamiz.
 */
function tokenMatches(token: string, stem: string, insidePhrase = false): boolean {
  if (token === stem) return true;
  // Qisqa o'zaklarga prefiks bo'yicha moslik XAVFLI: apostroflar olib
  // tashlangandan keyin "o'chirish" → "ochirish" bo'ladi va "och" o'zagi
  // unga ham mos kelib, "ochish" (open) bilan "o'chirish" (delete) chalkashadi.
  // Shuning uchun 4 belgidan qisqa o'zak faqat AYNAN mos kelishi kerak.
  //
  // ISTISNO: ko'p so'zli ibora ichida bu xavf yo'q, chunki QOLGAN so'zlar ham
  // mos kelishi shart. "pul otkaz" iborasidagi "pul" ni bloklash faqat zarar
  // qilardi — u yolg'iz emas, "otkaz" bilan birga tekshiriladi.
  const minLen = insidePhrase ? 3 : 4;
  if (stem.length < minLen) return false;
  if (token.startsWith(stem)) return true;
  if (stem.length >= 5 && stem.startsWith(token) && token.length >= 4) return true;
  return false;
}

/** Ko'p so'zli o'zak: har bir so'zi savolning biror tokeniga mos kelishi kerak. */
function phraseMatches(tokens: string[], phrase: string): boolean {
  const words = phrase.split(' ').filter(Boolean);
  if (words.length === 0) return false;
  const multi = words.length > 1;
  return words.every(w => tokens.some(t => tokenMatches(t, w, multi)));
}

function countMatches(tokens: string[], stems: string[]): number {
  let n = 0;
  for (const raw of stems) {
    const stem = normalizeQuestion(raw);
    if (stem && phraseMatches(tokens, stem)) n++;
  }
  return n;
}

/** "Qanday qilaman?" turidagi — ya'ni qo'llanmadan javob beriladigan savol belgilari. */
const HOWTO_MARKERS = [
  'qanday', 'qanaqa', 'qayerdan', 'qayerda', 'qayer', 'qaerdan', 'qaerda',
  'qilib', 'tartib', 'qollanma', 'organ', 'korsat', 'tushuntir',
  'mumkinmi', 'bormi', 'nima uchun', 'nimaga', 'nega', 'ishlaydi', 'ishlatiladi',
];

/**
 * Jonli MA'LUMOT yoki AMAL so'ralayotganini bildiruvchi belgilar. Bular bo'lsa
 * qo'llanmadan javob berish mumkin emas — real bazadan o'qish yoki tool ishlatish kerak.
 */
const DATA_MARKERS = [
  'qancha', 'nechta', 'necha', 'kimda', 'kimlar', 'hisobot ber',
  'bugun', 'kecha', 'ertaga', 'oxirgi', 'eng kop', 'eng katta', 'jami',
  'balans', 'statistika ber', 'yaratib ber', 'qoshib ber', 'ochib ber',
  'ozgartirib ber', 'ochirib', 'yuborib', 'hisoblab ber', 'topib ber',
  'royxatini ber', 'royxat ber', 'royxatini chiqar', 'royxatini korsat',
  // Amal bajarishga buyruq — "qanday" so'zi bo'lsa ham bu yo'l-yo'riq savoli EMAS.
  // Aynan shu yerga dashboard'dagi "Bartaraf etish" tugmasi yuboradigan matn
  // tushadi ("...Buni qanday hal qilishni maslahat bera olasizmi, kerak bo'lsa
  // o'zing bajar"). U qo'llanma javobini emas, jonli tahlil va amalni talab qiladi.
  'hal qil', 'bajar', 'chora', 'yechim top', 'nima qilish kerak',
];

function hasAnyToken(tokens: string[], markers: string[]): boolean {
  return markers.some(m => phraseMatches(tokens, normalizeQuestion(m)));
}

export interface KbMatch {
  entry: KbEntry;
  score: number;
  topicScore: number;
}

const TOPIC_WEIGHT = 2;
const ACTION_WEIGHT = 2;

/** Savolga mos KB yozuvlarini balli tartibda qaytaradi (eng mosi birinchi). */
export function searchKb(question: string, limit = 3): KbMatch[] {
  const tokens = normalizeQuestion(question).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const scored: KbMatch[] = [];
  for (const entry of GUIDE_KB) {
    // Mavzu mos kelmasa — yozuv umuman nomzod emas (ortiqcha shovqin oldi olinadi).
    //
    // Mavzu hissasi ATAYLAB 1 tadan oshmaydi: aks holda ko'p mavzu so'zi bor
    // yozuv faqat sinonimlari hisobiga yutib ketardi. Masalan "xodimga
    // oylikni to'layman" da xodim-tahrirlash yozuvi 'xodim' va 'oylik' ni
    // birdan tutib, maosh-hisob'dan o'zib ketardi. Endi mavzu faqat
    // "gap nima haqida" ni belgilaydi, tanlovni esa AMAL so'zi hal qiladi.
    const topicHits = Math.min(1, countMatches(tokens, entry.topics));
    if (topicHits === 0) continue;
    const actionHits = Math.min(2, countMatches(tokens, entry.actions));
    const topicScore = topicHits * TOPIC_WEIGHT;
    scored.push({
      entry,
      topicScore,
      score: topicScore + actionHits * ACTION_WEIGHT,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export type KbDecision =
  | { kind: 'answer'; entry: KbEntry }        // to'g'ridan-to'g'ri qo'llanmadan javob (LLM chaqirilmaydi)
  | { kind: 'context'; matches: KbMatch[] }   // LLM'ga qo'llanma parchasi berib yuboriladi
  | { kind: 'none' };

/**
 * Savolni tahlil qilib qaror qabul qiladi.
 *
 * Ehtiyotkorlik qoidasi: shubha bo'lsa LLM'ga o'tkazamiz. Noto'g'ri
 * "qo'llanma javobi" berish — LLM'ni bir marta chaqirishdan qimmatroq.
 */
export function decideKb(question: string): KbDecision {
  const normalized = normalizeQuestion(question);
  const tokens = normalized.split(' ').filter(Boolean);
  if (normalized.length < 4) return { kind: 'none' };

  const matches = searchKb(question, 3);
  if (matches.length === 0) return { kind: 'none' };

  // Jonli ma'lumot yoki bajariladigan amal so'ralyapti — qo'llanma javob bermaydi,
  // faqat LLM'ga qo'shimcha kontekst bo'lib boradi.
  if (hasAnyToken(tokens, DATA_MARKERS)) return { kind: 'context', matches };

  const isHowTo = hasAnyToken(tokens, HOWTO_MARKERS);
  const best = matches[0];
  const second = matches[1];
  const clearWinner = !second || best.score > second.score;

  if (isHowTo && clearWinner && best.topicScore >= TOPIC_WEIGHT && best.score >= 4) {
    return { kind: 'answer', entry: best.entry };
  }

  return { kind: 'context', matches };
}

/** LLM system prompt uchun qisqa indeks — AI qayerda nima borligini biladi. */
export function kbIndexText(): string {
  return GUIDE_KB.map(e => `${e.title} — ${e.page}`).join('; ');
}

/** Mos yozuvlarning to'liq matni — system prompt'ga qo'shiladi. */
export function kbContextText(matches: KbMatch[]): string {
  return matches
    .map(m => `[${m.entry.title} | ${m.entry.page}]\n${m.entry.answer}`)
    .join('\n\n');
}
