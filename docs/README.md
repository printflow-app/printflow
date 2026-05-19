# PrintFlow — Hujjatlar

PrintFlow loyihasi qo'llanmalari to'plami. Yangi feature'lar va sozlash bo'yicha yo'l-ko'rsatma.

---

## 🆕 Yangi qo'shilgan feature'lar (2026-05-19)

### 📨 [Support Bot](./SUPPORT_BOT.md)
Mijozlardan kelgan qo'llab-quvvatlash murojaatlarini super-adminga avtomatik yetkazadi. Mijoz matn, ovozli xabar, rasm va video yuborishi mumkin — hammasi bitta to'plamga yig'iladi.

**Tegishli rollar:** Super-admin (sozlash), tashqi foydalanuvchilar (ishlatish)

---

### 🎨 [Narx Ro'yxati Brandingi](./PRICE_LIST_BRANDING.md)
Mijozga ko'rinadigan narx ro'yxati va PDF/PNG eksportlarni to'liq sozlash:
- 8 ta alohida rang (header, narxlar, jadval, va h.k.)
- Logotip yuklash
- Kompaniya nomi, sarlavha, tagline, kontaktlar
- Live preview va PNG/PDF format select

**Tegishli rollar:** Admin yoki `canManageServices` huquqi bor xodimlar

---

### 🧮 [Buyurtma Taklifi (Quote Builder)](./QUOTE_BUILDER.md)
Sotuvchi mijoz so'roviga ko'ra **aniq narx hisoblab** chiroyli PDF/PNG quote yaratishi mumkin:
- Xizmat tanlash + opsiyalarni guruh bo'yicha (Sotni, O'lcham, Rang, va h.k.)
- Live narx hisoblash
- Savat (bir nechta qator + JAMI summa)
- Branding bilan PDF/PNG eksport

**Tegishli rollar:** Sotuvchi / admin

---

## 📂 Boshqa hujjatlar

| Fayl | Manzili | Vazifa |
|---|---|---|
| Loyiha umumiy ko'rinishi | [/PROJECT_BRIEF.md](../PROJECT_BRIEF.md) | Loyiha strategiyasi, texnik holati, biznes |
| Lokal dev sozlash | [/backend/LOCAL_DEV_SETUP.md](../backend/LOCAL_DEV_SETUP.md) | Mahalliy ishga tushirish qo'llanmasi |

---

## 🔗 Tezkor manzillar

- **Production frontend:** https://printflow-gilt.vercel.app
- **Production backend:** https://printflow-production-bb78.up.railway.app
- **Public price list misol:** https://printflow-gilt.vercel.app/price/puffprint

---

## 🧭 Boshlash uchun

1. Hech qachon ishlatmagan bo'lsangiz:
   - Avval: [PROJECT_BRIEF.md](../PROJECT_BRIEF.md) — loyiha umumiy ko'rinishi
   - Keyin: [LOCAL_DEV_SETUP.md](../backend/LOCAL_DEV_SETUP.md) — lokal sozlash

2. Bosmaxona egasi / admin sifatida:
   - [Narx Ro'yxati Brandingi](./PRICE_LIST_BRANDING.md) — eng birinchi: o'z brendingizni sozlang
   - [Buyurtma Taklifi](./QUOTE_BUILDER.md) — mijoz so'rovlariga tez javob bering

3. Super-admin (platforma egasi) sifatida:
   - [Support Bot](./SUPPORT_BOT.md) — mijoz murojaatlarini olish uchun bot sozlash

---

## 📝 Eslatma

Bu hujjatlar Uzbek tilida — loyiha bozori O'zbekiston ekanligi sababli. Texnik tafsilotlar (TypeScript tip'lari, fayl yo'llari, API'lar) ham har bir gude oxirida keltirilgan.

Yangi gude qo'shilsa, shu `README.md` indexga link qo'shing.
