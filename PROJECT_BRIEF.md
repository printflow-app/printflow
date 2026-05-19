# PrintFlow — Loyiha Hujjati

**Tayyorlangan:** 2026-05-18
**Kim uchun:** strategik munozara va potential texnik sherikni jalb qilish uchun
**Holat:** 2 ta mijoz (1 ta to'lovchi) — pre-PMF early stage

---

## 1. Loyiha Mohiyati

### Muammo
O'zbekistondagi bosmaxonalar (print-shop'lar) hozircha biznes jarayonlarini yo Excel'da yuritadi, yo umuman qo'lda — daftarda. Buning natijasida:

- Buyurtmalar yo'qoladi yoki kechikadi (Kanban tartibi yo'q)
- Mijozning qarzi qancha — aniq bilinmaydi (totalDebt / totalPaid jadval yo'q)
- Xodim qancha pul oldi, qancha berildi — chalkash (avans / maosh / qarz)
- Material qoldig'i nazoratdan chiqib ketadi (joriy zaxira / minimum chegara yo'q)
- Hisobotlar yo'q yoki bir oyda bir marta qo'lda yig'iladi
- Bosmaxona egasi har bir mayda ish bilan o'zi shug'ullanadi — vaqti yo'q

### Yechim
**PrintFlow — Bosmaxona Boshqaruv Tizimi (SaaS).**

Bitta tizimda: buyurtmalar Kanban'i, mijozlar bazasi, kassa, ombor, davomat, xodimlar boshqaruvi, hisobotlar, Telegram bot xabarnomalari, AI Copilot (so'rovlar uchun). Multi-tenant — har bosmaxonaga o'z workspace'i, izolatsiya bilan.

### Pozitsiya
- **Bozor:** O'zbekiston (RUaz interfeysi)
- **Maqsadli mijoz:** kichik-o'rta bosmaxonalar (5-50 xodim, 1-5 filial)
- **Narx modeli:** SaaS obuna (Plan-based, oylik/yillik)
- **Hozirgi raqobat:** asosan Excel + 1C umumiy ERP'lar. Bosmaxonaga maxsus mahalliy yechim deyarli yo'q.

---

## 2. Hozirgi Texnik Holati

### Stack

**Frontend:**
- React 18 + TypeScript + Vite
- Tailwind CSS (utility-first)
- React Router DOM
- React Query (server state, caching)
- React-Toastify (notifications)
- Lucide React (icons)
- Vercel'da deploy

**Backend:**
- NestJS (Node.js framework)
- Prisma ORM + PostgreSQL (Railway hosted)
- JWT auth (httpOnly cookie + Bearer fallback)
- Telegraf (Telegram bot)
- Class-validator + class-transformer (DTO validation)
- @nestjs/schedule (cron jobs)
- @nestjs/throttler (rate limiting)
- Railway'da deploy + auto `prisma db push` har deploy'da

**Infra:**
- DB: PostgreSQL on Railway (`switchback.proxy.rlwy.net`)
- Backend: Railway (`printflow-production-bb78.up.railway.app`)
- Frontend: Vercel
- Bot: Long-polling (webhook'siz, lokal va prod'da ishlaydi)

### Kod hajmi (taxminan)
- **Prisma schema:** 981 qator, **35 ta model**
- **Backend modullari:** 26 ta (auth, tenants, employees, customers, tasks, finance, inventory, attendance, services, vendors, billing, plans, telegram, ai, reports, kpi, branches, departments, notifications, va h.k.)
- **Frontend sahifalari:** 22 ta (Dashboard, Kassa, Topshiriqlar, Mijozlar, Ombor, Davomat, Hodimlar, Hamkorlar, Hisobotlar, Sozlamalar va h.k.)

### Arxitektura prinsiplari
- **Multi-tenant izolatsiya:** har bir tenant uchun PostgreSQL row-level filtering via Prisma middleware + `TenantContext` (AsyncLocalStorage)
- **Multi-branch:** har tenant ichida bir nechta filial — services, vendors, tasks, transactions branchId bo'yicha izolyatsiyalanadi
- **Department:** filial ichida bo'limlar (analytics + role scoping uchun)
- **RBAC (Role-Based Access Control):** ~75 granular permission (canViewFinance, canManageInventory, canExportFinance va h.k.). Role-larga bu ruxsatlar boolean field'lar sifatida biriktiriladi
- **Feature gating:** Plan modeli orqali — har tarifda qaysi modul yoqilgan (kanban, finance, inventory, attendance, multiBranch, ai_chat, ...). Backend `FeatureGuard` + frontend `tenantFeatures` orqali tekshiradi
- **AI Copilot:** Anthropic API orqali — tenant tarifida `ai_chat` bo'lsa va platforma global toggle yoqilgan bo'lsa ishlaydi

### Mavjud asosiy funksiyalar (to'liq ishlayotgan)
1. **Kassa** — kirim/chiqim tranzaksiyalari, sana/bo'lim/hamkor bo'yicha filtr, Excel eksport
2. **Topshiriqlar (Kanban)** — drag-drop kartochkalar, bosqichlar (yangi → tayyor), mas'ullar, deadline, mijoz qarzi tracking, vendor outsourcing
3. **Mijozlar bazasi** — B2B kontaktlar, qarz/to'lov tarixi, buyurtmalar tarixi, top mijozlar
4. **Ombor** — materiallar + BOM (Bill of Materials), kirim/chiqim/brak, minimal zaxira ogohlantirish
5. **Xizmatlar katalogi (Pricing Engine)** — xizmatlar + opsiyalar + material normalari → narx kalkulyatori
6. **Davomat** — QR-kod orqali kelish/ketish, GPS gating, ofis Wi-Fi allowlist, ortiqcha ish (overtime)
7. **Hodimlar** — xodimlar, avans, qarz, maosh
8. **Hamkorlar (Vendors)** — subpudratchilar, ularga buyurtma berish, qarz hisobi
9. **Hisobotlar** — xizmatlar samaradorligi, hamkor foydaliligi, xodim tezligi, o'sish ko'rsatkichlari, oylik dinamika
10. **Tizim sozlamalari** — lavozimlar + ruxsatlar, to'lov turlari, xarajat kategoriyalari, Kanban bosqichlari, Telegram bildirishnomalar
11. **Filiallar** — multi-branch boshqaruv, bo'limlar, filial menejeri
12. **Ma'muriyat (Admins)** — workspace admin hisoblari
13. **Telegram bot** — buyurtma xabarnomasi, davomat, ortiqcha ish so'rovi, kunlik hisobot
14. **AI Copilot** — xizmatlar haqida savol-javob, ko'rsatma berish
15. **Public price list** — mijozlarga ulashish uchun ochiq narx ro'yxati sahifasi
16. **Onboarding tour** — yangi tenant uchun guided tour (non-modal, spotlight)
17. **Excel eksport** — sahifa bo'yicha alohida ruxsat bilan
18. **Sidebar notification badges** — yangi tasklar/past stock/pending overtime uchun
19. **Mobile/iOS PWA support** — localStorage'da auth fallback (iOS Safari ITP uchun)

### Texnik kuchli tomonlar
- **Toza modullar:** har feature alohida NestJS module, frontend alohida sahifa — yangi feature qo'shish oson
- **Type safety:** TS strict mode + Prisma generated types — kod yozishda xavf kam
- **Multi-tenant secure-by-default:** tenant izolyatsiya guard/middleware darajasida, dasturchi unutib qo'ya olmaydi
- **Auth fleksibilligi:** cookie (web) + Bearer (mobile/PWA) + Telegram WebApp — har platformada ishlaydi
- **Plan/feature gating:** tariff o'zgartirilsa avtomatik UI va backend mos keladi
- **DB sync:** har deploy'da `prisma db push` — schema o'zgarishlari avtomatik
- **AI yordamida tezkor shipping:** murakkab feature'lar 1-2 kunda yetkaziladi (men + Claude = sizning loyihangiz uchun real dev partner)

### Texnik zaif tomonlar (ochiq aytaman)
- **Backend test coverage** — yo'q. Hech qanday unit/integration test yozilmagan. Bug regression xavfi bor.
- **Monitoring/observability** — yo'q. Production'da xato bo'lsa, Railway log'larini qo'lda o'qiymiz. Sentry / Datadog kerak.
- **Database backup** — Railway'ning default backup'iga ishonadi. O'z backup strategiyamiz yo'q.
- **Performance** — hozircha 1-2 mijoz uchun yetarli. 50+ mijoz bo'lganda: index'lar yetarlimi, query'lar optimallashganmi — tekshirilmagan.
- **Senior backend egaligi** — siz va men birga yozyapmiz. Murakkab muammolar (transaction deadlock, race condition, complex migration) yuzaga kelganda — yagona javobgar yo'q.
- **Security audit** — biror professional security review qilmagan. JWT/auth ishlayapti, lekin penetration test o'tkazilmagan.
- **CI/CD** — sodda Railway/Vercel auto-deploy. Production deploy oldidan testlar yo'q.
- **Documentation** — fragmentar (CLAUDE.md kabi memory'lar bor, lekin to'liq tech doc yo'q).
- **Error handling** — har joyda bir xil emas. Foydalanuvchi ko'rib qo'rqishi mumkin bo'lgan xom xato xabarlari bor.
- **Mobile native app yo'q** — faqat web/PWA. Bosmaxona xodimlari ko'pincha telefondan kirsa, native iOS/Android yo'qligi sezilishi mumkin.

### Hozirgi shipping tezligi (mening kuzatishimcha)
Sizning AI-assisted ish jarayoningiz:
- Yangi feature: 1-3 kun (masalan: bildirishnoma toggle + SMS tahriri — bugun 1 sessiyada bajarildi)
- Bug fix: minutlar dan soatlargacha
- Schema o'zgarishi: 30 daqiqa (yangi field + migration auto + UI + permission)

Bu senior dev jamoasining 2-3 baravar tezligi. Real **leverage**.

---

## 3. Biznes Holati

- **Mijozlar:** 2 ta (1 to'lovchi)
- **MRR (oylik daromad):** kichik
- **Burn rate:** deyarli yo'q (Railway free tier, Vercel free, Claude API o'zingiz to'laysiz)
- **Runway:** noma'lum — chunki burn juda kam
- **Investor:** yo'q (bootstrap)
- **Jamoa:** 1 kishi (siz — CEO, kod yozasiz, sotuv qilasiz)

### Sotuv kanali
- Hozircha noma'lum / og'zaki tarmoq?

### Pricing model
- Plan modeli mavjud (Tenant.planId), lekin haqiqiy SaaS pricing tezligi qanday — bilmayman. Bu sotuv hujjatida yoritilishi kerak.

---

## 4. Texnik Sherikga (potential CTO/founding engineer) Nima Beradi

Agar sizning ishonchli sherigingiz qo'shilsa, u nimani topadi:

**Tayyor narsalar:**
- 22 sahifalik to'liq ishlovchi web app
- 35 ta DB model + multi-tenant izolyatsiya
- Auth, RBAC, feature gating tugagan
- Telegram bot ishlayotgan
- Deploy pipeline avtomatlashtirilgan
- AI Copilot integratsiyalashgan
- 2 ta haqiqiy mijoz feedback beradi

**Uning birinchi oyda qila oladigan ishlari:**
- Frontend bug'lar va UX yaxshilash (ko'p ish bor — qarz badge'lar, polish, mobile responsive tuning)
- Test yozish boshlash (Jest backend, Vitest frontend)
- Sentry/monitoring qo'shish
- Mijozlardan kelgan so'rovlarni implement qilish

**Uning 6 oyda o'sa oladigan yo'nalishi:**
- Senior frontend dev → fullstack
- DevOps va monitoring oyiga 1 marta tegishi mumkin
- AI integration ham kengaytiriladi
- 1-2 yil ichida texnik qarorlar uning yelkasiga ko'cha boshlaydi → CTO yo'li

---

## 5. Keyingi 3-6 Oyga Texnik Yo'l Xaritasi (Taklif)

**P0 — Birinchi shu hafta:**
- Local DB'ni schema bilan sinxronlash (`prisma db push`) — `canExport*` xatosi sababli buzilgan
- Sherigingiz bilan onboarding: README'ni qo'shish, lokal setup qo'llanmasi, kodbazaga qisqacha tour

**P1 — Birinchi 1 oy (sherik qo'shilgach):**
- Sentry yoki Logtail — production error tracking
- Backend uchun bir nechta integration test (auth, tenant isolation, basic CRUD)
- README + ENVIRONMENT.md (lokal setup, env variables)
- 5-10 ta mijoz feedback'i bo'yicha UX bug fix sprint

**P2 — Birinchi 3 oy:**
- Pricing/billing flow qattiqlashtirish (Click/Payme integratsiyasi to'liq, agar zarur)
- Onboarding/trial flow optimizatsiya (yangi tenant qaysi qadamlarda yo'qoladi?)
- Mobile responsive polish (xodimlar telefondan kiradi)
- Performance: kalit query'larga `EXPLAIN ANALYZE`, kerakli index'lar
- AI Copilot use case kengaytirish (Telegram bot'da AI ham bo'lsin?)

**P3 — Birinchi 6 oy:**
- iOS/Android native app (Capacitor yoki React Native)
- Mahalliy to'lov gateway (Click, Payme) integratsiyasi to'liq
- Multi-language interface (Rus tili — Rossiya bozorga chiqishni rejalashtirsangiz)
- B2B integratsiyalar (1C export, Excel import flow)

---

## 6. Sherik Bilan Muhokama Qilish Kerak Bo'lgan Savollar

1. **Vaqt:** kuniga necha soat ishlay oladi? Hozirgi ishidan voz kechadimi?
2. **Maqsad:** sotuvga ham qiziqadimi yoki sof kod yozadigan dev bo'lib qoladimi?
3. **O'rganishga tayyormi?** Senior backend uchun bo'shliq bor — buni AI bilan birga to'ldirishga qiziqadimi?
4. **Ulush:** 12-15% bilan 4 yil vest + 1 yil cliff — adolatli ko'rinadimi?
5. **Maosh:** hozir maosh yo'q — qachondan boshlab ramziy summa ($200-300/oy) bera olamiz? MRR'ning 10%-imi?
6. **Mojaro yechish:** strategik kelishmovchilik bo'lganda kim oxirgi so'zga ega? (Odatda CEO — siz)
7. **Co-founder yoki founding engineer?** Bu nominal farq, lekin u uchun muhim bo'lishi mumkin

---

## 7. Yakuniy Nuqta

PrintFlow — pre-PMF early stage startup, lekin **MVP emas, real ishlovchi tizim**. 1 ta to'lovchi mijoz allaqachon bor. Texnik baza yaxshi tashkil etilgan, kengaytirish va saqlash oson.

Eng katta riskingiz **hozircha texnik emas — sotuv tezligi**. 10 ta to'lovchi mijoz topish — 10 ta yangi feature qurish'dan muhimroq.

Sherikingiz qo'shilsa, sizning CEO sifatida 80%+ vaqtingiz sotuv va customer success'ga o'tadi. U esa frontend + AI bilan backend yuritadi. Bu konfiguratsiya pre-PMF stage uchun **optimal**.

---

*Bu hujjat real-time loyiha holatiga asoslangan (2026-05-18). Codebase'dagi har bir modul va texnik qaror — fakt. Biznes hisob-kitobi (mijoz soni, MRR, runway) — siz bergan ma'lumotlarga asoslangan.*
