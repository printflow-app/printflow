# Narx Ro'yxati Brandingi

PrintFlow narx ro'yxati (`/price/<slug>`) va buyurtma takliflari endi to'liq sozlanadi: **ranglar**, **logo**, **kompaniya nomi**, **sarlavha**, **tagline**, **kontaktlar**.

Bir marta sozlasangiz — barcha mijozlarga ko'rsatiladigan narx ro'yxati va sotuvchi tomonidan yuboriladigan PDF/PNG buyurtmalari **bir uslubda** ko'rinadi.

---

## 1. Qaerga kirish

**Sozlamalar** → "Xizmatlar Katalogi"dan keyin **"Narx Ro'yxati Brandingi"** bo'limi.

Foydalanish huquqi: **Admin** yoki **`canManageServices`** ruxsati bor xodimlar.

---

## 2. Sozlanadigan elementlar

### 2.1. Logotip

- Format: PNG yoki JPG
- Maksimal hajm: **300 KB**
- Maslahat: kvadrat (1:1) logo eng yaxshi ko'rinadi
- Kichik faylda yaxshi ko'rinadi — header'da 64×64 px ga moslanadi

> **Eslatma:** Logo `base64` sifatida `SystemSetting`'da saqlanadi. Katta fayllar uchun keyinroq alohida upload endpoint qo'shiladi.

### 2.2. Matnlar

| Maydon | Vazifa | Default |
|---|---|---|
| **Kompaniya nomi** | Yuqori panelda H1 sifatida ko'rinadi. Bo'sh qoldirilsa tenant nomi (`tenant.name`) ishlatiladi | `tenant.name` |
| **Sarlavha** | Sarlavha ostidagi kichik matn | `"Narxlar ro'yxati"` (quote'da `"Buyurtma taklifi"`) |
| **Tagline** | Sarlavha ostidagi qo'shimcha qator | Bo'sh |
| **Telefon** | Filial telefonini almashtirish | `branch.phone` |
| **Manzil** | Filial manzilini almashtirish | `branch.address` |
| **Footer matni** | Pastdagi izoh | `"Narxlar o'zgarishi mumkin"` |

### 2.3. Ranglar (8 ta)

Har bir rang **alohida** sozlanadi. Mijoz HEX kod (color picker) tanlaydi.

| # | Rang nomi | Qayerga ta'sir qiladi |
|---|---|---|
| 1 | **Header foni** | Yuqori brending paneli fon rangi (gradient avtomatik to'q variantga o'tadi) |
| 2 | **Kompaniya nomi rangi** | Katta H1 kompaniya nomi matnining rangi |
| 3 | **Header qo'shimcha matni** | Sarlavha, tagline, sana, telefon, manzil matnlari |
| 4 | **Asosiy narx rangi** | Har xizmatning katta narxi (masalan: `50,000 so'm`) |
| 5 | **Jadval sarlavhasi foni** | Opsiyalar jadvalining yuqori qatori (Opsiya / Soni / Narxi / Summasi) |
| 6 | **Jadval sarlavhasi matni** | Ustun nomlari matnining rangi |
| 7 | **Kartochka chegara rangi** | Har xizmat bloki atrofidagi nozik chiziq rangi |
| 8 | **Yakuniy summa rangi** | Jadvaldagi oxirgi "Summasi" ustuni qiymatlari rangi |

> Har rang sozlash katakchasida **tushuntirish** va **HEX kod input** bor (qo'lda kiritish ham mumkin).

---

## 3. Sozlash oqimi

1. **Sozlamalar** sahifasini oching → "Narx Ro'yxati Brandingi" bo'limini toping
2. **Logo** yuklang (ixtiyoriy)
3. **Matnlar** bo'limini to'ldiring (ixtiyoriy)
4. **Ranglar** ro'yxatidan har birini tanlang — har bir o'zgarish o'ng tomonda **jonli preview** ko'rsatiladi
5. **"Saqlash"** tugmasini bosing
6. Saqlandi! Endi:
   - `/price/<slug>` — mijozga ochiladigan narx ro'yxati yangi ko'rinishda
   - Admin **"Price list"** modali — bir xil branding bilan
   - PDF/PNG eksportlar ham yangi ranglar va matnlar bilan

> "Default" tugmasi ranglar va matnlarni asl holatga qaytaradi (saqlash kerak).

---

## 4. Eksport formatlari

Xizmatlar Katalogi sahifasidagi **"Price list"** tugmasini bossangiz, modaldagi ikkala tab'da ham eksport tugmasi bor:

| Format | Vazifa | Ishlash usuli |
|---|---|---|
| **PNG** | Rasm fayli (rangli, yuqori sifat) | `html-to-image` (pixelRatio: 2) |
| **PDF** | A4 portrait, ko'p sahifali | `jspdf` + `addImage` (auto-pagination) |

**Print tugmasi** ham bor — to'g'ridan-to'g'ri printerga yo'naltiradi.

### Tab'larda farq

| Tab | Kim uchun | Eksport tugmasi |
|---|---|---|
| **Umumiy narxlar** | Mijozga to'liq prays-list yuborish | Modal pastida (Print + PNG/PDF) |
| **Buyurtma taklifi** | Sotuvchi mijoz so'roviga ko'ra narx hisoblash | Savat panelida o'rnatilgan |

---

## 5. Mijoz ko'rinishi

`https://printflow-gilt.vercel.app/price/puffprint`

Mijoz uchun bu sahifa:
- ❌ **Auth talab qilmaydi** (public)
- ✅ Filial select (bir nechta filial bo'lsa)
- ✅ Print tugmasi
- ✅ Brendingiz bilan to'liq jihozlangan

> **Eslatma:** Public sahifada **buyurtma builder yo'q** — buyurtma takliflarini sotuvchi admin modalidan tuzadi (qarang: [QUOTE_BUILDER.md](./QUOTE_BUILDER.md)).

---

## 6. Texnik tafsilotlar

### Backend
- Sozlamalar `SystemSetting` jadvalida saqlanadi
- Kalit: `PRICE_LIST_BRANDING`
- Tenant-scoped (har bosmaxonaga o'z brandingi)
- API: `GET /api/settings/PRICE_LIST_BRANDING` va `POST /api/settings/PRICE_LIST_BRANDING`
- Public endpoint `GET /api/services/public/:slug` javobiga `branding` field qo'shilgan (raw SQL bilan, public route tenant interceptor'siz)

### Frontend
- Type definitsiyasi: `frontend/src/components/PriceListView.tsx` → `PriceListBranding`
- Sozlash UI: `frontend/src/components/PriceListBrandingSection.tsx`
- Eksport komponentlari: `PriceListView.tsx` va `QuoteView.tsx` — `branding` propini qabul qiladi
- Default ranglar default eksport `DEFAULT_BRANDING` (orange + slate) — sozlanmagan tenantlar uchun regression yo'q

### Tip definitsiya (TypeScript)
```typescript
interface PriceListBranding {
  headerBg?: string;
  headerText?: string;
  companyNameColor?: string;
  accent?: string;
  tableHeaderBg?: string;
  tableHeaderText?: string;
  cardBorder?: string;
  totalSum?: string;
  logoBase64?: string;
  companyName?: string;
  headerTitle?: string;
  tagline?: string;
  phone?: string;
  address?: string;
  footerNote?: string;
}
```

---

## 7. Tez-tez uchraydigan savollar

### Logo katta — yuklab bo'lmaydi
300 KB cheklov bor. Logo'ni siqib qayta yuklang (https://tinypng.com yoki shunga o'xshash xizmat). Yo'q bo'lsa, kvadrat 256×256 px PNG kifoya.

### Ranglarni qanday tanlash mantiqiy?
- **Header foni** = brendingiz asosiy rangi (logo bilan mos)
- **Kompaniya nomi rangi** = header foniga kontrast (odatda oq yoki sariq)
- **Asosiy narx rangi** = header foniga yaqin, lekin biroz to'qroq
- **Jadval sarlavhasi foni** = to'q rang (slate-800, qora va h.k.) — kontrastli ko'rinadi
- **Kartochka chegara rangi** = juda yumshoq (slate-200 atrofida)

### Saqlanmadi — backend xato beradi
Backend log'larini tekshiring. Quote-on-Quote (`"`) yoki maxsus belgilar `JSON.stringify` bilan to'g'ri ishlanishi kerak, lekin xato bo'lsa raporting qiling.

### Logo o'chirilmayapti
"O'chirish" tugmasi `logoBase64`'ni `undefined` qiladi. Keyin "Saqlash" bosing.
