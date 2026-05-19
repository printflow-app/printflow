# Lokal Postgres bilan ishlash (dev tezligi uchun)

Bu yo'l Railway DB'ga xalqaro internet orqali murojaat qilishni to'xtatadi.
Har Prisma query ~1000ms o'rniga ~1ms bo'ladi.

---

## VARIANT 1 — Postgres'ni Windows'ga to'g'ridan-to'g'ri o'rnatish (TAVSIYA)

### 1. Postgres yuklab olish va o'rnatish

1. https://www.postgresql.org/download/windows/ ga boring
2. "Download the installer" — EDB versiyasini olasiz
3. **Postgres 16.x** versiyasini tanlang (eng yangisi)
4. Installer'ni ishga tushiring:
   - Port: **5432** (sukut)
   - Password: **postgres** (sukut — ya'ni `postgres` user uchun parol `postgres`)
   - Locale: sukut
   - StackBuilder: KERAK EMAS, oxirida belgilab o'tib bo'lasiz
5. O'rnatish tugagach, Postgres Windows service sifatida avtomatik ishga tushadi

### 2. DB yaratish

PowerShell oching:

```powershell
# Postgres binarylarini PATH'ga qo'shing (yoki to'liq yo'l bilan ishlatish)
$env:PATH += ";C:\Program Files\PostgreSQL\16\bin"

# DB yaratish
createdb -U postgres printflow_dev
# Parol so'raganda: postgres
```

### 3. Schema'ni qo'llash

```powershell
cd D:\PrintFlow\backend
npx prisma db push
```

Bu lokal Postgres'da barcha jadvallarni yaratadi (Railway'dagidek).

### 4. Seed (boshlang'ich ma'lumotlar)

```powershell
npm run prisma:seed
```

Bu superadmin va demo tenant yaratadi. Login ma'lumotlari `seed.ts` ichida.

### 5. Backend va frontend'ni ishga tushirish

```powershell
# Backend
cd D:\PrintFlow\backend
npm run start:dev

# Yangi terminal — Frontend
cd D:\PrintFlow\frontend
npm run dev
```

Endi siz lokal Postgres'da ishlaysiz. Har query ~1-5ms.

---

## VARIANT 2 — Docker bilan (Docker Desktop o'rnatilgan bo'lsa)

```powershell
cd D:\PrintFlow\backend
docker compose up -d
```

Postgres `localhost:5432`'da ishga tushadi. Keyin 3-bosqichdan davom eting (`prisma db push`).

To'xtatish: `docker compose down`. Ma'lumotlarni o'chirish bilan: `docker compose down -v`.

---

## Railway DB ga qaytish (kerak bo'lsa)

`backend/.env` faylida:

1. Aktiv `DATABASE_URL=` qatorni izohga oling (`#` qo'shing)
2. Pastdagi `# DATABASE_URL=...railway...` qatordan `#` ni olib tashlang

Yoki `.env.railway` faylidagi to'liq tarkibni `.env`'ga ko'chiring.

Backend'ni qayta ishga tushiring.

---

## Lokal DB'ga eski Railway ma'lumotlarini ko'chirish (ixtiyoriy)

Agar lokal DB'da haqiqiy ma'lumotlar kerak bo'lsa:

```powershell
# 1. Railway'dan dump olish
$env:PATH += ";C:\Program Files\PostgreSQL\16\bin"
pg_dump "postgresql://postgres:eDwJptngKQlrCPBAWclfzyTAzaAsMTWN@switchback.proxy.rlwy.net:54697/railway?sslmode=require" --no-owner --no-acl > railway-dump.sql

# 2. Lokal DB'ga import
psql -U postgres -d printflow_dev -f railway-dump.sql
```

E'tibor: bu Railway'dagi barcha ma'lumotlarni lokalga ko'chiradi (testlar, mijozlar, fayllar).

---

## Tezlik solishtirish

| Operatsiya | Railway DB (lokaldan) | Lokal Postgres |
|---|---|---|
| Bitta Prisma query | ~1000 ms | ~1-5 ms |
| Topshiriqlar sahifa ochilishi | 2-5 daqiqa | ~500 ms |
| Drag-drop | 4 daqiqa | Darhol |
| Modal save | 5-6 daqiqa | < 1 sek |

---

## Muammolar

**`createdb` topilmadi** → PATH'ga `C:\Program Files\PostgreSQL\16\bin` qo'shilmagan. Yuqoridagi `$env:PATH += ...` buyrug'ini bajaring.

**`Connection refused` `localhost:5432`** → Postgres service ishlamayapti. Windows Services'da `postgresql-x64-16` ni qidiring va Start qiling.

**`Password authentication failed`** → Postgres parolingiz `postgres` emas. `.env` faylidagi `DATABASE_URL`'da parolni to'g'rilang.
