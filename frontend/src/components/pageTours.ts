// =============================================
// SAHIFA QO'LLANMALARI
//
// Ro'yxatdan o'tgandagi sozlash tour'i (OnboardingTour dagi SETUP_STEPS)
// bir martalik va chiziqli: filial → lavozim → xizmat → xodim → kanban.
// U tizimni ISHGA TUSHIRISH uchun, ishlatish uchun emas.
//
// Bu yerdagilar boshqacha: har sahifaning o'z qisqa qo'llanmasi bor va
// foydalanuvchi uni istagan payt, o'sha sahifada turib ochadi (tepadagi
// "Yo'l-yo'riq" tugmasi). Shuning uchun ular:
//   - qisqa (3-5 qadam) — 40 qadamli tourni hech kim oxirigacha ko'rmaydi
//   - sahifalar orasida yurmaydi — foydalanuvchi allaqachon kerakli joyda
//   - ruxsati yo'q tugmani ko'rsatmaydi (target DOM'da bo'lmasa, qadam
//     tashlab ketiladi — PageTour shuni o'zi filtrlaydi)
//
// Qadam qo'shishdan oldin: target sifatida ishlatilgan `data-tour-id`
// haqiqatan sahifada borligiga ishonch hosil qiling, aks holda qadam
// jimgina yo'qoladi.
// =============================================

export type PageTourStep = {
  id: string;
  /** CSS selector. Bo'lmasa — kartochka o'ng chetda, halqasiz chiqadi. */
  target?: string;
  title: string;
  /** HTML sifatida chiqariladi (qalin matn, ro'yxat). */
  description: string;
};

export const PAGE_TOURS: Record<string, PageTourStep[]> = {
  // ===== BOSH SAHIFA — butun tizim bo'ylab yo'nalish =====
  boshsahifa: [
    {
      id: 'bosh-intro',
      title: 'Bosh sahifa — kunlik holat',
      description: `Bu yerda bugungi tushum, faol buyurtmalar, davomat va
        ogohlantirishlar bir ekranda turadi. Raqam ustiga bosilsa —
        tegishli sahifaga o'tadi.<br><br>
        Keling, chapdagi asosiy bo'limlarni ko'rsatib chiqay.`,
    },
    {
      id: 'bosh-kassa',
      target: '[data-tour-id="nav-kassa"]',
      title: 'Kassa — pul harakati',
      description: `Har bir kirim va chiqim shu yerdan yoziladi.
        Kassalar alohida yuritiladi, ular orasida pul topshirish mumkin.`,
    },
    {
      id: 'bosh-kanban',
      target: '[data-tour-id="nav-topshiriqlar"]',
      title: 'Xizmatlar (Kanban) — buyurtmalar',
      description: `Buyurtma qabul qilinganidan topshirilgunicha shu doskada
        bosqichma-bosqich yuradi. Maosh KPI'si ham shu yerdan hisoblanadi —
        buyurtma <b>bajarilgan</b> deb belgilangan oyga yoziladi.`,
    },
    {
      id: 'bosh-hisobot',
      target: '[data-tour-id="nav-hisobotlar"]',
      title: 'Hisobotlar — tahlil',
      description: `Tushum dinamikasi, xizmatlar kesimi, xodimlar
        samaradorligi va zararsizlik nuqtasi shu yerda.`,
    },
    {
      id: 'bosh-qidiruv',
      title: 'Tezkor qidiruv',
      description: `Istalgan joyda <b>Ctrl + K</b> bosing — sahifa, mijoz yoki
        buyurtmani nomi bo'yicha topasiz. Sichqonchasiz ishlashning eng tez yo'li.`,
    },
  ],

  // ===== KASSA =====
  kassa: [
    {
      id: 'kassa-intro',
      title: 'Kassa — pul kirdi-chiqdi',
      description: `Tepadagi sanalar oralig'i butun sahifaga ta'sir qiladi:
        summalar ham, ro'yxat ham shu oraliqdan olinadi.`,
    },
    {
      id: 'kassa-kirim',
      target: '[data-tour-id="kassa-kirim"]',
      title: 'Kirim yozish',
      description: `Mijozdan pul olinganda shu tugma. Buyurtmaga bog'lansa,
        summa o'sha buyurtmaning to'lovi sifatida hisoblanadi va qarzdorlik
        avtomatik kamayadi.`,
    },
    {
      id: 'kassa-chiqim',
      target: '[data-tour-id="kassa-chiqim"]',
      title: 'Chiqim yozish',
      description: `Xarajat turini tanlash majburiy — hisobotlardagi
        "qayerga ketdi" tahlili aynan shu turlar bo'yicha quriladi.<br><br>
        Xodimga avans ham shu yerdan: u maosh hisobidan avtomatik ayiriladi.`,
    },
    {
      id: 'kassa-topshirish',
      target: '[data-tour-id="kassa-topshirish"]',
      title: 'Kassadan kassaga topshirish',
      description: `Smena oxirida pulni asosiy kassaga topshirish.
        Qabul qiluvchi sanab, tasdiqlaguncha summa "yo'lda" turadi —
        shuning uchun ikkala tomonda ham qoldiq to'g'ri chiqadi.`,
    },
    {
      id: 'kassa-yangi',
      target: '[data-tour-id="kassa-yangi-kassa"]',
      title: 'Yangi kassa',
      description: `Har filial yoki har smena uchun alohida kassa ochish
        mumkin. Kassa ochilgach uni o'chirib bo'lmaydi — tarixdagi
        tranzaksiyalar unga bog'langan.`,
    },
  ],

  // ===== XIZMATLAR (KANBAN) =====
  topshiriqlar: [
    {
      id: 'kanban-intro',
      title: "Kanban — buyurtma yo'li",
      description: `Har ustun — jarayonning bir bosqichi. Kartani sudrab
        keyingi ustunga o'tkazasiz; oxirgi ("bajarildi" deb belgilangan)
        ustunga tushganda buyurtma yakunlangan hisoblanadi.`,
    },
    {
      id: 'kanban-column',
      target: '[data-tour-id="kanban-add-column"]',
      title: 'Bosqich qo\'shish',
      description: `Bosqichlar sizning haqiqiy jarayoningizga mos bo'lishi
        kerak: masalan <b>Yangi</b> → <b>Dizayn</b> → <b>Bosma</b> →
        <b>Tayyor</b> → <b>Berildi</b>.<br><br>
        Ustun sozlamasida uni "bajarildi" deb belgilash mumkin — KPI va
        maosh hisobi aynan shunga qaraydi.`,
    },
    {
      id: 'kanban-order',
      target: '[data-tour-id="buyurtma-add"]',
      title: 'Yangi buyurtma',
      description: `Bitta buyurtmaga bir nechta xizmat qo'shiladi
        (vizitka + banner + futbolka). Ular bitta buyurtma sifatida
        hisoblanadi — maoshda ham "buyurtma boshiga" shu birlik oladi.<br><br>
        <b>Mas'ul</b> maydonini to'ldirishni unutmang: KPI o'sha xodimga yoziladi.`,
    },
    {
      id: 'kanban-arxiv',
      title: 'Arxiv va eksport',
      description: `Yakunlangan eski buyurtmalarni arxivga oling — doska
        yengillashadi, lekin ma'lumot yo'qolmaydi va hisobotlarda qoladi.`,
    },
  ],

  // ===== JAMOA VAZIFALARI =====
  vazifalar: [
    {
      id: 'vazifa-intro',
      title: 'Jamoa doskasi — kim nima bilan band',
      description: `Kanbandan farqi: u yerda fokus buyurtmada, bu yerda
        <b>odamda</b>. Shuning uchun bu doskada buyurtmalar ham, operatsion
        vazifalar ham birga ko'rinadi.<br><br>
        Tepadagi ismli tugmalar — kimda nechta faol ish borligi. Bosilsa
        faqat o'sha xodim qoladi.`,
    },
    {
      id: 'vazifa-add',
      target: '[data-tour-id="vazifa-add"]',
      title: 'Vazifa qo\'shish',
      description: `Buyurtma bo'lmagan ishlar uchun: "qarzdorlarni obzvon
        qilish", "printerga kartrij olish".<br><br>
        Mas'ul tanlansa — unga Telegramga xabar ketadi.`,
    },
    {
      id: 'vazifa-move',
      title: 'Bosqichni o\'zgartirish',
      description: `Kartani sudrab boshqa ustunga tashlang, yoki karta
        ostidagi <b>→ Jarayonda</b> tugmalaridan foydalaning (telefonda
        sudrash ishlamaydi, tugmalar esa doim ko'rinadi).<br><br>
        <b>Buyurtma</b> kartalari bu yerda ko'chmaydi — ularning bosqichi
        Kanban sahifasida boshqariladi, aks holda ikki joyda ikki xil holat
        paydo bo'lardi.`,
    },
  ],

  // ===== MIJOZLAR =====
  mijozlar: [
    {
      id: 'mijoz-intro',
      title: 'Mijozlar bazasi',
      description: `Har mijozning buyurtmalari, to'lovlari va qarzdorligi
        bir kartada yig'iladi. Qidiruv ism va telefon bo'yicha ishlaydi.`,
    },
    {
      id: 'mijoz-add',
      target: '[data-tour-id="mijoz-add"]',
      title: 'Mijoz qo\'shish',
      description: `Telefon raqami — asosiy maydon: buyurtma yaratganda
        mijoz aynan shu bo'yicha topiladi.<br><br>
        Kompaniya bo'lsa, bir nechta kontakt shaxs qo'shish mumkin.`,
    },
    {
      id: 'mijoz-qarz',
      title: 'Qarzdorlik',
      description: `Qarz alohida yozilmaydi — u buyurtma summasi bilan
        to'langan summa farqidan o'zi chiqadi. Ya'ni raqamni qo'lda
        to'g'rilash kerak emas, to'lovni Kassaga yozish kifoya.`,
    },
  ],

  // ===== HAMKORLAR =====
  hamkorlar: [
    {
      id: 'hamkor-intro',
      title: 'Hamkorlar (subpudratchilar)',
      description: `O'zingiz bajarmaydigan ishni beradigan tashqi ustalar:
        payvandchi, chopar, boshqa bosmaxona. Ular bilan hisob-kitob shu
        yerda yuritiladi.`,
    },
    {
      id: 'hamkor-add',
      target: '[data-tour-id="hamkor-add"]',
      title: 'Hamkor qo\'shish',
      description: `Hamkor qo'shilgach, buyurtma ichida unga xarajat
        biriktirasiz. Shunda buyurtmaning <b>sof foydasi</b> to'g'ri
        hisoblanadi — hamkorga ketgan pul ayiriladi.`,
    },
    {
      id: 'hamkor-hisob',
      title: 'Qarz va to\'lov',
      description: `Hamkorga qancha qarzdorsiz — buyurtmalardagi xarajat
        yig'indisidan unga to'langan summa ayirilib chiqadi. To'lovni
        Kassadan chiqim qilib yozganingizda balans o'zi yangilanadi.`,
    },
  ],

  // ===== OMBOR =====
  ombor: [
    {
      id: 'ombor-intro',
      title: 'Ombor — material qoldig\'i',
      description: `Qog'oz, plyonka, bo'yoq kabi sarflanadigan materiallar.
        Ikkita ko'rinish bor: <b>materiallar</b> (hozirgi qoldiq) va
        <b>harakatlar</b> (nima kirdi, nima chiqdi).`,
    },
    {
      id: 'ombor-add',
      target: '[data-tour-id="material-add"]',
      title: 'Material qo\'shish',
      description: `<b>Minimal qoldiq</b> maydonini to'ldiring — qoldiq shu
        chegaradan pastga tushganda tizim ogohlantiradi. Aks holda material
        tugaganini buyurtma o'rtasida bilib qolasiz.`,
    },
    {
      id: 'ombor-bom',
      title: 'Xizmatga material bog\'lash (BOM)',
      description: `Xizmatga "1 dona uchun qancha material ketadi" deb
        yozib qo'ysangiz, buyurtma bajarilganda qoldiq avtomatik kamayadi —
        qo'lda hisobdan chiqarish kerak emas.`,
    },
  ],

  // ===== DAVOMAT =====
  davomat: [
    {
      id: 'davomat-intro',
      title: 'Davomat — kelish-ketish',
      description: `Xodim QR kodni telefonida skanerlab keladi va ketadi.
        Kechikish daqiqalari avtomatik sanaladi va maosh sxemasida
        jarima sifatida ishlatilishi mumkin.`,
    },
    {
      id: 'davomat-settings',
      target: '[data-tour-id="davomat-settings"]',
      title: 'Ish vaqti sozlamalari',
      description: `Ish boshlanish/tugash vaqti, ish kunlari va
        <b>geolokatsiya doirasi</b> shu yerda.<br><br>
        Doira yoqilgan bo'lsa, xodim faqat ish joyi atrofida turib
        belgilana oladi — uydan turib skanerlab bo'lmaydi.`,
    },
    {
      id: 'davomat-qr',
      title: 'QR kod',
      description: `QR kod bir marta chop etiladi va devorga osiladi —
        u o'zgarmaydi. Yo'qolsa yoki tarqalib ketsa, Sozlamalardan
        yangisini generatsiya qiling: eskisi darhol ishlamay qoladi.`,
    },
  ],

  // ===== XODIMLAR =====
  hodimlar: [
    {
      id: 'hodim-intro',
      title: 'Xodimlar',
      description: `Har xodimning lavozimi, filiali, maoshi va ish
        ko'rsatkichlari shu yerda. Lavozim nafaqat nom — u xodim nimani
        ko'rishi va o'zgartirishini belgilaydi.`,
    },
    {
      id: 'hodim-add',
      target: '[data-tour-id="hodim-add"]',
      title: 'Xodim qo\'shish',
      description: `Saqlaganingizda tizim <b>login va parol</b> yaratadi —
        ularni xodimga uzating. Parolni keyin ham qaytadan generatsiya
        qilish mumkin.`,
    },
    {
      id: 'hodim-maosh',
      title: 'Maosh va KPI',
      description: `Maosh sxemasi <b>lavozim</b>ga biriktiriladi
        (Sozlamalar → Maosh), lekin ayrim xodimga alohida sxema ham
        berish mumkin — u lavozimnikidan ustun turadi.<br><br>
        Sxemasi yo'q xodimning maoshi avvalgidek qo'lda yoziladi.`,
    },
  ],

  // ===== SOZLAMALAR =====
  sozlamalar: [
    {
      id: 'sozlama-intro',
      title: 'Sozlamalar — bir uzun sahifa',
      description: `Bu sahifa bo'limlarga bo'lingan: lavozimlar, to'lov
        turlari, xizmatlar katalogi, maosh sxemasi, Telegram va boshqalar.
        Pastga aylantirib boring.`,
    },
    {
      id: 'sozlama-lavozim',
      target: '[data-tour-id="lavozim-add"]',
      title: 'Lavozimlar va ruxsatlar',
      description: `Ruxsatlar aynan shu yerda beriladi. Masalan sotuvchi
        Kassani ko'rsin-u, umumiy balansni ko'rmasin.<br><br>
        Ruxsat o'zgartirilsa, xodim keyingi kirishida yangi holatni oladi.`,
    },
    {
      id: 'sozlama-tolov',
      target: '[data-tour-id="payment-type-form"]',
      title: 'To\'lov turlari',
      description: `Naqd, Karta, Click, Payme — o'zingizda qanday bo'lsa
        shunday yozing. Bu turlar Kassada to'lov qabul qilganda ro'yxatda
        chiqadi va hisobotlarda alohida kesim beradi.`,
    },
    {
      id: 'sozlama-xizmat',
      target: '[data-tour-id="xizmat-add"]',
      title: 'Xizmatlar katalogi',
      description: `Narxlar shu yerda turadi va buyurtma yaratganda
        avtomatik tortiladi. Opsiyalar (qog'oz turi, lak, rang) narxni
        oshirib/kamaytirib boradi.<br><br>
        Katalog narxnoma (price list) sifatida ham chiqariladi.`,
    },
    {
      id: 'sozlama-maosh',
      title: 'Maosh sxemasi va KPI sanasi',
      description: `Sxema — "nimadan qancha" degan qoidalar to'plami:
        fiksa, buyurtma boshiga, foiz, davomat sharti.<br><br>
        <b>KPI boshlanish sanasi</b>ni belgilashni unutmang — usiz KPI'ga
        o'tishdan oldingi butun arxiv birinchi oyning maoshiga qo'shilib
        ketadi.`,
    },
  ],

  // ===== HISOBOTLAR =====
  hisobotlar: [
    {
      id: 'hisobot-intro',
      title: 'Hisobotlar',
      description: `Tepadagi sana oralig'i va filial tanlovi butun sahifaga
        ta'sir qiladi. Bo'lim tanlansa — faqat o'sha bo'limning raqamlari.`,
    },
    {
      id: 'hisobot-kpi',
      title: 'Xodimlar samaradorligi',
      description: `Har xodimning bajargan buyurtmalari, summasi va
        rejaga nisbatan foizi. Raqamlar Kanbandagi <b>bajarilgan</b>
        buyurtmalardan olinadi — ya'ni doska to'g'ri yuritilsa, hisobot
        ham to'g'ri bo'ladi.`,
    },
    {
      id: 'hisobot-breakeven',
      title: 'Zararsizlik nuqtasi',
      description: `Doimiy xarajatlaringizni qoplash uchun oyiga qancha
        tushum kerakligini ko'rsatadi. Xarajat turlarini to'g'ri
        belgilasangiz, bu raqam ham aniq bo'ladi.`,
    },
    {
      id: 'hisobot-export',
      target: '[data-tour-id="hisobot-export"]',
      title: 'Excelga eksport',
      description: `Ekrandagi barcha jadval bir faylga, har biri alohida
        varaqqa tushadi. Filtr qanday bo'lsa, eksport ham shunday.`,
    },
  ],

  // ===== MOLIYA =====
  moliya: [
    {
      id: 'moliya-intro',
      title: 'Moliya — umumiy manzara',
      description: `Kassa har bir yozuvni ko'rsatsa, bu sahifa yig'ib
        beradi: davr bo'yicha kirim, chiqim va sof natija.`,
    },
    {
      id: 'moliya-farq',
      title: 'Nega Kassadagi raqamdan farq qiladi?',
      description: `Kassalararo topshirish tushum sifatida sanalmaydi —
        pul tashkilot ichida ko'chdi, yangi pul kirmadi. Shuning uchun
        Moliyadagi "kirim" Kassa ro'yxatidagi barcha yozuvlar
        yig'indisidan kichik bo'lishi normal.`,
    },
  ],

  // ===== MA'MURIYAT =====
  admins: [
    {
      id: 'admin-intro',
      title: "Ma'muriyat",
      description: `Ikkita tab bor: <b>Ma'murlar</b> — workspace egalari,
        va <b>Filiallar</b>.`,
    },
    {
      id: 'admin-filial',
      target: '[data-tour-id="admin-tab-branches"]',
      title: 'Filiallar',
      description: `Har filialning o'z kassasi, xodimlari va buyurtmalari
        bo'ladi. Tepadagi filial tanlovi orqali hisobotlarni bittasiga
        cheklash mumkin.`,
    },
  ],

  // ===== BILLING =====
  billing: [
    {
      id: 'billing-intro',
      title: 'Obuna',
      description: `Joriy tarif, muddat va to'lovlar tarixi.
        To'lov qilgach chekni yuklaysiz — tasdiqlangach muddat
        avtomatik uzayadi.`,
    },
  ],
};

/** Shu sahifaning qo'llanmasi bormi. */
export function hasPageTour(tab: string): boolean {
  return (PAGE_TOURS[tab]?.length || 0) > 0;
}
