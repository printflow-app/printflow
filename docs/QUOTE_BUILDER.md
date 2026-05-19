# Buyurtma Taklifi — Sotuvchi qo'llanmasi

Mijoz so'roviga ko'ra **aniq narx hisoblab**, chiroyli PDF/PNG quote yaratish uchun yangi vosita.

> **Muhim:** Bu vositani **sotuvchi (admin)** ishlatadi. Mijoz public sahifada faqat umumiy narx ro'yxatini ko'radi va o'zi buyurtma tuzmaydi.

---

## 1. Misol oqim

**Mijoz Telegram orqali yozadi:**
> "Salom, 70 ta futbolka (M o'lcham, qora) va 70 ta kepka kerak. Qancha bo'ladi?"

**Sotuvchi PrintFlow'da:**

1. Admin paneliga kiradi → **Sozlamalar** → **Xizmatlar Katalogi**
2. Yuqori-o'ngdagi **"Price list"** tugmasini bosadi → Modal ochiladi
3. Modal yuqorisidagi **"🧮 Buyurtma taklifi"** tab'ga o'tadi
4. **Futbolka** kartochkasida:
   - O'lcham guruhidan `M` ni bosadi
   - Rang guruhidan `Qora` ni bosadi
   - Soni: `70`
   - **"Qo'shish"** tugmasi → savatga tushadi
5. **Kepka** kartochkasida:
   - Soni: `70`
   - **"Qo'shish"** → savatda
6. Pastda **JAMI** summa avtomatik hisoblanadi
7. Format select: **PDF** → **"Yuklab olish"**
8. Yaratilgan PDF'ni Telegram orqali mijozga jo'natadi ✅

Vaqt: **30 soniya**

---

## 2. Modal yuqorisidagi 2 tab

### Tab 1: 📄 Umumiy narxlar (default)

**Qachon ishlatish:** Mijozga to'liq prays-list (barcha xizmatlar) yuborish

- Chap panelda: xizmatlar checkbox ro'yxati — qaysilarini ko'rsatishni tanlash
- O'ng tomonda: live preview (PriceListView)
- Pastda: Print + Format select (PNG/PDF) + Yuklab olish

### Tab 2: 🧮 Buyurtma taklifi (yangi)

**Qachon ishlatish:** Mijoz aniq so'rov bersa (masalan: "70 futbolka kerak")

- Chap tomonda: mahsulot kartochkalari (har birida opsiyalar + miqdor + Qo'shish)
- O'ng tomonda: savat (tanlangan qatorlar + JAMI summa + Yuklab olish)

---

## 3. Buyurtma taklifi tab'i — to'liq qo'llanma

### 3.1. Mahsulot kartochkasi

Har bir xizmat uchun bitta kartochka. Tarkibi:

```
┌────────────────────────────────────────┐
│ [rasm]  FUTBOLKA          50,000 so'm  │
│                              / dona     │
│                                         │
│ SOTNI:    [50]  [100]                  │
│ O'LCHAM:  [S]   [M]   [L]              │
│ RANG:     [Qora]  [Oq]                 │
│                                         │
│ SONI:                                   │
│ [−] [70] [+]                            │
│                                         │
│ HISOB:                                  │
│ 47,000 × 70 = 3,290,000 so'm           │
│                                         │
│              [+ Qo'shish]               │
└────────────────────────────────────────┘
```

### 3.2. Opsiyalar guruh bo'yicha

Xizmatlar Katalogi'da kiritilgan opsiyalar **`name`** maydoni bo'yicha **avtomatik guruhlanadi**.

Misol — Futbolka uchun opsiyalar:
- `{ name: "Sotni", value: "50", priceAdd: 0 }`
- `{ name: "Sotni", value: "100", priceAdd: -5000 }`
- `{ name: "O'lcham", value: "S", priceAdd: 0 }`
- `{ name: "O'lcham", value: "M", priceAdd: 2000 }`
- `{ name: "O'lcham", value: "L", priceAdd: 5000 }`
- `{ name: "Rang", value: "Qora", priceAdd: 0 }`
- `{ name: "Rang", value: "Oq", priceAdd: 0 }`

Quote builder'da 3 ta guruh ko'rinadi:
- **SOTNI:** `[50]` `[100]`
- **O'LCHAM:** `[S]` `[M]` `[L]`
- **RANG:** `[Qora]` `[Oq]`

Har guruhdan **max 1 ta** opsiya tanlanadi. Bossangiz — tanlanadi; qaytadan bossangiz — bekor qilinadi.

> **Maslahat:** Xizmatlar Katalogi'da opsiya qo'shganda `name` qiymatini izchil yozing — `"Sotni"` va `"sotni"` boshqa-boshqa guruhga tushadi.

### 3.3. Narx formulasi

```
Yakuniy narx (dona) = basePrice + Σ(tanlangan opsiyalar priceAdd)
Qator summasi      = Yakuniy narx × Soni
Jami buyurtma      = Σ(barcha qatorlar summasi)
```

**Misol:**
- Futbolka basePrice = `50,000`
- "Sotni: 100" → `−5,000`
- "O'lcham: M" → `+2,000`
- "Rang: Qora" → `0`
- **Yakuniy narx** = `50,000 − 5,000 + 2,000 + 0 = 47,000 so'm`
- Soni: `70`
- **Qator summasi** = `47,000 × 70 = 3,290,000 so'm`

### 3.4. Savat (o'ng panel)

```
┌─────────────────────────┐
│ 🛒 Sizning buyurtmangiz │
│         (2)   Tozalash  │
├─────────────────────────┤
│ FUTBOLKA            🗑  │
│ Sotni: 100, O'lcham: M, │
│ Rang: Qora              │
│ [−] [70] [+]            │
│ 47,000 × 70             │
│ 3,290,000 so'm          │
│                         │
│ KEPKA               🗑  │
│ [−] [70] [+]            │
│ 35,000 × 70             │
│ 2,450,000 so'm          │
├─────────────────────────┤
│ JAMI: 5,740,000 so'm    │
│                         │
│ [PDF ▼] [Yuklab olish]  │
└─────────────────────────┘
```

**Funksiyalar:**
- **🗑** — bitta qatorni o'chirish
- **`[−] [+]`** — miqdorni 1 ga oshirish/kamaytirish
- **Soni input** — to'g'ridan-to'g'ri qiymat kiritish
- **Tozalash** — butun savatni bo'shatish (tasdiqlash bilan)
- **Format select** — PDF yoki PNG
- **Yuklab olish** — quote yuklab olish

### 3.5. Yuklab olingan PDF/PNG ichida nima bor

```
┌──────────────────────────────────────────┐
│  [logo]  KOMPANIYA NOMI       Sana       │
│          Buyurtma taklifi     Telefon    │
│          Filial               Manzil     │
├──────────────────────────────────────────┤
│ # | Mahsulot       | Soni | Narxi | Summa│
├──────────────────────────────────────────┤
│ 1 | Futbolka       | 70   | 47,000| 3.29M│
│   | Sotni:100,O'l..|      |       |      │
│ 2 | Kepka          | 70   | 35,000| 2.45M│
├──────────────────────────────────────────┤
│                          JAMI: 5,740,000│
├──────────────────────────────────────────┤
│ Kompaniya © 2026  | Narxlar o'zgarishi mumkin │
└──────────────────────────────────────────┘
```

Quote PDF/PNG **Sozlamalar > Narx Ro'yxati Brandingi**dagi ranglar, logo, sarlavha, footer'larni avtomatik qo'llaydi.

---

## 4. Tez tip'lar

### Bir nechta variant'ni alohida qo'shish
Mijoz "20 ta qora futbolka + 50 ta oq futbolka" so'rasa:
1. O'lcham: M, Rang: Qora, Soni: 20 → "Qo'shish"
2. O'lcham: M, Rang: Oq, Soni: 50 → "Qo'shish"

Savatda 2 qator alohida ko'rinadi.

### Opsiyasiz xizmat
Agar xizmatda opsiya yo'q bo'lsa (masalan: "Vizit karta"), faqat **Soni** kiritish kerak. "Qo'shish" tugmasi to'g'ridan-to'g'ri savatga qo'shadi.

### Savatdan opsiya o'zgartirish mumkinmi?
**Yo'q.** Qator qo'shilgach, opsiya o'zgarmaydi. Faqat **soni** o'zgartiriladi. Boshqa opsiyali variantni qo'shish uchun: savatdan o'chiring, qaytadan tanlab qo'shing.

### Buyurtmani saqlash mumkinmi?
Hozircha **yo'q** — savat brauzer xotirasida (state). Modal yopilganda yo'qoladi. Keyinroq "Buyurtmani saqlash" tugmasi qo'shilishi mumkin.

---

## 5. Mijoz uchun fayl nomi

Yuklangan fayl avtomatik shunday nomlanadi:

```
buyurtma-puffprint-2026-05-19.pdf
buyurtma-puffprint-2026-05-19.png
```

- `puffprint` — tenant slug
- `2026-05-19` — bugungi sana

Mijozga yuborishda fayl nomini o'zingiz o'zgartirib jo'natishingiz mumkin.

---

## 6. Texnik tafsilotlar

### Fayl strukturasi
```
frontend/src/components/
├── QuoteView.tsx         # PDF/PNG eksport uchun A4 layout
├── QuoteBuilder.tsx       # Interaktiv UI (savat bilan)
├── PriceListView.tsx      # Umumiy narx ro'yxati layout
├── PriceListModal.tsx     # Tab switcher: Umumiy narxlar / Buyurtma taklifi
└── PriceListBrandingSection.tsx  # Sozlamalar UI
```

### Asosiy logika
- `QuoteBuilder` ichida `cart: CartLine[]` state
- Har `CartLine` da: service, selectedOptions (array, har guruhdan max 1), quantity
- `calcLine` — narx hisoblaydi
- Eksport vaqtida `QuoteView` off-screen render qilinadi → `html-to-image` PNG → `jspdf` PDF
- Multi-page PDF: rasm balandligi A4 dan kattaroq bo'lsa, `pdf.addPage()` bilan bo'linadi

### Branding qo'llanishi
- `PriceListModal` API'dan branding'ni yuklaydi (`/api/services/public/:slug`)
- `QuoteBuilder.data.branding` → `QuoteView` ham xuddi shu branding'ni ishlatadi
- Logo, ranglar, sarlavha, footer — barchasi avtomatik qo'llanadi

---

## 7. Tez-tez uchraydigan savollar

### Opsiyalar guruhlanmayapti
Xizmatlar Katalogi'da opsiyalarning `name` qiymati izchil emas. Misol: bittasi `"Sotni"`, ikkinchisi `"sotni "` (ortiqcha probel) — bu boshqa-boshqa guruhga tushadi. Tahrir qiling.

### Narx noto'g'ri hisoblanyapti
Tekshiring: opsiyaning `priceAdd` qiymati to'g'ri kiritilganmi? Negativ qiymat (`−5,000`) chegirma, positiv qiymat qo'shimcha.

### PDF bo'sh ko'rinadi
Brauzer cache'i. `Ctrl+Shift+R` bilan hard refresh qiling. Eksport oldidan kamida 1 qator savatda bo'lishi shart.

### Buyurtma builder mijoz tomonida ham bo'lsin
Avval public sahifada tab toggle bor edi, lekin sotuvchi yo'naltirishi sababli olib tashlandi. Qaytarish kerak bo'lsa, `frontend/src/pages/PublicPriceList.tsx` ga `QuoteBuilder` import qilib tab toggle qo'shing.
