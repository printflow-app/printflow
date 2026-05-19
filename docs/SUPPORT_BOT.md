# Support Bot — Mijoz murojaatlari uchun Telegram bot

PrintFlow tizimida 2 ta alohida Telegram bot ishlaydi:

| Bot | Vazifa | Foydalanuvchi |
|---|---|---|
| **Asosiy bot** (`TELEGRAM_BOT_TOKEN`) | Tenant xodimlariga bildirishnoma yuborish (davomat, buyurtma, hisobot) | Bosmaxona xodimlari |
| **Support bot** (`SUPPORT_BOT_TOKEN`) | Mijozlardan qo'llab-quvvatlash murojaatlarini super-adminga yetkazish | Tashqi foydalanuvchilar |

Bu hujjat **Support bot** haqida.

---

## 1. Maqsadi

Mijozlar (yoki yangi foydalanuvchilar) PrintFlow ishlatishida muammo, savol yoki taklifga ega bo'lsa, support botga yozib yuborsa, **super-admin** Telegram'da yetib keladi. Bot:

- **Bir nechta xabarni bitta to'plamga yig'adi** — mijoz "Xabar yuborish" tugmasini bosib istalgancha matn/ovoz/rasm/video yuborishi mumkin
- Mijoz "✅ Yuborish" tugmasini bosgach, hamma xabarlar super-adminga ketma-ket forward qilinadi
- Yuqorida header bilan: kim yuborgani, username, til, premium status, bio va boshqalar

---

## 2. Sozlash (super-admin uchun)

### 2.1. Bot tokenini qo'shish

`backend/.env` faylga:

```env
SUPPORT_BOT_TOKEN="8641335104:AAGaooY-ka51m3Zw6ZpMAGJ504SpkYokEes"
SUPPORT_BOT_ADMIN_CHAT_IDS=""
```

> Token BotFather'dan olinadi. Hozirgi token allaqachon kiritilgan.

### 2.2. Super-admin chat ID'ni olish

1. Botni Telegram'da oching va `/start` bosing
2. Keyin `/myid` komandasini yuboring
3. Bot quyidagicha javob qaytaradi:
   ```
   🆔 Sizning chat ID: 123456789
   ```
4. Bu raqamni nusxa oling

### 2.3. Chat ID'ni `.env` ga qo'shing

```env
SUPPORT_BOT_ADMIN_CHAT_IDS="123456789"
```

**Bir nechta super-admin** bo'lsa, vergul bilan ajrating:

```env
SUPPORT_BOT_ADMIN_CHAT_IDS="123456789,987654321,555666777"
```

### 2.3.1. Guruh chat'ga yuborish (Tavsiya etiladi)

Murojaatlar bitta odamga emas, **dasturchilar guruhi**ga kelishi uchun:

1. **Botni guruhga qo'shing** — guruh sozlamalari → "Add members" → bot username'ni topib qo'shing
2. **Guruhda komanda yuboring:** `/myid@your_bot_username`
   > ⚠️ Privacy mode (default) sababli guruhda botning komandasini `@bot_username` bilan yozish shart. Aks holda bot ko'rmaydi.
3. Bot guruhda javob qaytaradi:
   ```
   🆔 Guruh chat ID (My Dev Team): -1001234567890
   
   Murojaatlar shu guruhga kelishi uchun bu raqamni
   SUPPORT_BOT_ADMIN_CHAT_IDS env o'zgaruvchisiga qo'shing.
   ```
4. Bu **manfiy raqam**ni nusxalang (masalan `-1001234567890`)
5. Railway env yoki `.env`'ga qo'shing:
   ```env
   SUPPORT_BOT_ADMIN_CHAT_IDS="-1001234567890"
   ```
6. Backend qayta yoqing → endi har mijoz murojaati shu guruhga keladi

**Bir nechta guruh + shaxsiy chat** bir vaqtda:
```env
SUPPORT_BOT_ADMIN_CHAT_IDS="-1001234567890,6272228211"
```

> **Eslatma:** Bot guruhda spam qilmaydi — guruhda kelgan oddiy xabarlarga javob bermaydi, faqat `/myid@bot` komandasiga javob qaytaradi. Murojaat oqimi (Xabar yuborish tugmasi) faqat **shaxsiy chat'da** ishlaydi (mijoz uchun).

### 2.4. Production (Railway) sozlash

Railway dashboard'da → **Variables** bo'limida:

- `SUPPORT_BOT_TOKEN` — bot tokeni
- `SUPPORT_BOT_ADMIN_CHAT_IDS` — chat ID'lar (vergul bilan)

Saqlash. Railway service avtomatik qayta yoqiladi.

### 2.5. Backend qayta yoqish (lokal dev)

```powershell
# Backend terminalida Ctrl+C, keyin:
npm run start:dev
```

Log'da quyidagi ko'rinish kerak:

```
🚀 Support bot polling boshlandi
```

`WARN [SupportBotService] SUPPORT_BOT_ADMIN_CHAT_IDS bo'sh` xato ko'rinmasa — sozlash tugadi.

---

## 3. Mijoz oqimi

Mijoz botga `/start` yuboradi:

```
👋 Xush kelibsiz!

Bu — PrintFlow qo'llab-quvvatlash boti.
Murojaatingizni yuborish uchun pastdagi 📨 Xabar yuborish 
tugmasini bosing.

Matn, ovozli xabar, rasm va video yuborishingiz mumkin.

[📨 Xabar yuborish]
[ℹ️ Yordam]
```

### Murojaatni yig'ish:

1. **"📨 Xabar yuborish"** tugmasini bosadi
2. Bot prompt beradi:
   ```
   📝 Murojaatingizni yozing.
   
   Bir nechta xabar yuborishingiz mumkin — 
   matn, ovozli xabar, rasm, video — istalgan format.
   
   Tayyor bo'lganingizda quyidagi ✅ Yuborish tugmasini bosing.
   
   [✅ Yuborish]
   [❌ Bekor qilish]
   ```
3. Mijoz istalgancha xabar yuboradi (matn, ovozli, rasm, video, hujjat — barchasi qo'llab-quvvatlanadi)
4. **"✅ Yuborish"** tugmasini bosgach, hammasi super-adminga ketadi
5. Mijoz tasdiq oladi:
   ```
   ✅ Murojaatingiz yuborildi!
   
   Rahmat. Tez orada siz bilan bog'lanamiz.
   ```

---

## 4. Super-admin nima oladi

Murojaat bilan birga **header xabar** keladi:

```
📨 Yangi qo'llab-quvvatlash murojaati

👤 Ism familiya: John Doe
• Ism: John
• Familiya: Doe
🔗 Username: @johndoe
💬 Kontakt: @johndoe
🆔 Telegram ID: 123456789
🌐 Til: uz
⭐ Premium: ha
📝 Bio: Toshkentlik dizayner
📦 Xabarlar soni: 3

⤵️ Quyida murojaat mazmuni:
```

Keyin mijozning barcha xabarlari **`copyMessage`** orqali nusxalanadi — rasm sifati, ovozli xabar formati, video formati saqlanadi.

Oxirda ajratuvchi chiziq: `— — — — — — — — — —`

---

## 5. Bot komandalari to'liq ro'yxati

| Komanda | Vazifa |
|---|---|
| `/start` | Botni boshlash, welcome xabarini olish |
| `/myid` | O'z Telegram chat ID'ngizni olish (super-admin sozlash uchun) |
| `/cancel` | Yarim yozilgan murojaatni bekor qilish |

---

## 6. Texnik tafsilotlar (dasturchi uchun)

### Fayl strukturasi
```
backend/src/modules/support-bot/
├── support-bot.module.ts
└── support-bot.service.ts
```

### Asosiy xususiyatlar
- **Alohida Telegraf instansiya** — asosiy `TelegramService` bilan aralashmaydi
- **In-memory session** (`Map<chatId, Session>`) — DB schema o'zgartirmaydi, restart yarim yozilgan draftni yo'qotadi (qisqa muddatli interaktiv flow uchun kifoya)
- **Webhook'siz polling rejim** — bir vaqtda 2 ta bot ishlash uchun konflikt yo'q
- **`copyMessage` API** — fayllar qayta yuklanmaydi, faqat Telegram serverida nusxa ko'chiriladi (formatlar saqlanadi)
- `bot.telegram.getChat(chatId)` — qo'shimcha ochiq ma'lumotlar (bio) uchun ishlatiladi

### Logikasi
1. `onModuleInit` — token va admin ID'larni o'qish, bot launch
2. Har mijoz `/start` qilganda yangi `Session` yaratiladi (state: IDLE)
3. "📨 Xabar yuborish" → state: COLLECTING
4. COLLECTING'da kelgan har qanday xabar `Session.items[]` ga qo'shiladi
5. "✅ Yuborish" → har admin chat ID uchun:
   - Header `sendMessage`
   - Har item uchun `copyMessage`
   - Footer chiziq

---

## 7. Tez-tez uchraydigan muammolar

### "SUPPORT_BOT_TOKEN topilmadi — Support bot o'chirilgan"
`.env` da `SUPPORT_BOT_TOKEN` qo'shilmagan yoki bo'sh. Token qo'shing va backend qayta yoqing.

### "SUPPORT_BOT_ADMIN_CHAT_IDS bo'sh..."
Murojaat keladi, lekin yuborish manzili yo'q. `/myid` bilan chat ID oling va `.env`'ga kiriting.

### "Murojaat keldi, lekin SUPPORT_BOT_ADMIN_CHAT_IDS sozlanmagan"
Mijoz xabar yubordi, lekin admin ID yo'q. Yuqoridagi kabi tuzating.

### Logikani o'zgartirish kerak bo'lsa
Asosiy fayl: `backend/src/modules/support-bot/support-bot.service.ts`. Telegraf API hujjati: https://telegraf.js.org/
