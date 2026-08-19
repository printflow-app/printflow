# PrintFlow — Design System

Bu hujjat **nishonni** belgilaydi: "bir xil tugma" degani aynan nima, "o'qiladigan
matn" qanchа, "loading" qanday ko'rinadi. Bu qadam-baqadam buyruq emas —
yo'lni o'zing tanlaysan, lekin natija shu yerda yozilganidek bo'lishi kerak.

Qoida bittasi hammasidan muhim:

> **Komponentda xom qiymat yozilmaydi.** `#ea580c` emas, `--primary`.
> `14px` emas, `--control-h`. Ro'yxatda yo'q narsa kerak bo'lsa — avval shu
> hujjatga qo'shiladi, keyin ishlatiladi.

---

## 1. Rang

### Brend — bitta to'q sariq

| Token | Qiymat | Qachon |
|---|---|---|
| `--brand-50` | `#fff7ed` | juda yengil fon (faol menyu punkti) |
| `--brand-100` | `#ffedd5` | avatar foni, badge foni |
| `--brand-200` | `#fed7aa` | badge ramkasi |
| `--brand-600` | `#ea580c` | **primary** — asosiy harakat |
| `--brand-700` | `#c2410c` | hover |
| `--brand-800` | `#9a3412` | active (bosilgan holat) |

Hozir kodda ikkita to'q sariq bor: `#f2610d` (tokenda) va `#ea580c` (kodda 34
marta). Bittasi qoladi — `#ea580c`, chunki u haqiqatda ishlatilgan.

> **Bajarildi (2026-08-19):** kodda uchta to'q sariq bor edi — `#FF6B00`
> (78 marta), `orange-500` (#f97316, 65 marta) va token `#ea580c`. Hammasi
> bitta `primary-*` shkalasiga keltirildi; xom hex qolmadi.

### To'q sariq qayerda ko'rinadi

Rang kam bo'lsa ilova "o'lik" tuyuladi, ko'p bo'lsa ko'z asosiy harakatni
topolmaydi. Shuning uchun ro'yxat aniq:

| Joy | Ko'rinishi |
|---|---|
| Ekrandagi asosiy harakat | to'ldirilgan tugma (`btn-primary`) — ekranda **bitta** |
| Faol menyu punkti | `--brand-50` fon + `--brand-200` ramka + brend rangli ikonka |
| Faol tab | oq fon, brend rangli matn va ikonka |
| Tanlangan element (chip, karta) | `--brand-50` fon + `--brand-300` ramka, to'ldirilmaydi |
| Brend belgisi (logo, avatar, AI ikonkasi) | to'q sariq |
| Grafikdagi asosiy seriya | `chartColors.primary` |

Bezak uchun (ajratuvchi chiziq, oddiy ikonka, statik matn) ishlatilmaydi.

### Uchinchi rang — to'q ko'k (`--ink`)

| Token | Qiymat | Qachon |
|---|---|---|
| `--ink` | `#0f172a` | yakuniy natija paneli |
| `--ink-soft` | `#1e293b` | hover |
| `--ink-foreground` | `#ffffff` | ustidagi matn |

Brend uchligi: **oq (fon) + to'q sariq (harakat) + to'q ko'k (natija)**.

Qoida: **bir ekranda bitta** to'q ko'k panel — o'sha ekranning yakuniy
raqami. Shunda ko'z sahifaga tushishi bilan asosiy natijani topadi:

| Sahifa | To'q ko'k panel |
|---|---|
| Kassa | Davr balansi |
| Dashboard | 30 kunlik sof |
| Hisobotlar | Sof foyda |
| Statistika | Samaradorlik yig'indisi |

Komponentda: `<StatCard variant="ink">` yoki `bg-ink`. Ikkita to'q ko'k panel
bir ekranda turmaydi — u holda ikkalasi ham "asosiy" bo'lib qoladi va
ierarxiya yo'qoladi.

### Neytral — bitta shkala, iliq

`#ffffff` · `#fdfcfb` · `#faf9f7` · `#f5f2ee` · `#e7e2db` · `#d6cfc5` ·
`#a8a29e` · `#78716c` · `#57534e` · `#44403c` · `#292524` · `#1c1917`

Nega iliq: tokenlarda allaqachon iliq (`#faf9f7`, `#e7e2db`) yozilgan, lekin
komponentlarda sovuq kulrang ishlatilgan. Ikkalasi bir ekranda turgani uchun
sayt "kir" ko'rinadi. Iliq neytral to'q sariq bilan yaxshi turadi.

### Rollar

| Rol | Nima uchun |
|---|---|
| `--bg-main` | sahifa foni |
| `--bg-surface` | karta, panel, jadval foni |
| `--bg-hover` | sichqoncha ustida |
| `--border` | oddiy ramka |
| `--border-strong` | hover'dagi ramka |
| `--foreground` | asosiy matn |
| `--muted-foreground` | yordamchi matn, izoh |
| `--subtle-foreground` | placeholder, jadval sarlavhasi |

> **Ierarxiya muhim.** Hozir `--muted-foreground` asosiy matn bilan **aynan bir
> xil** rangda. Shuning uchun ekranda ierarxiya yo'q — hamma narsa bir xil qora.
> Asosiy matn, yordamchi matn va placeholder uchtasi ko'zga farq qilib turishi kerak.

### Holat ranglari

| Holat | Matn | Fon | Ramka | To'ldirilgan |
|---|---|---|---|---|
| Muvaffaqiyat | `#047857` | `#ecfdf5` | `#a7f3d0` | `#059669` |
| Xato / qarz | `#b91c1c` | `#fef2f2` | `#fecaca` | `#dc2626` |
| Ogohlantirish | `#b45309` | `#fffbeb` | `#fde68a` | `#d97706` |
| Ma'lumot | `#1d4ed8` | `#eff6ff` | `#bfdbfe` | `#2563eb` |

**Rang = ma'no.** Yashil "yaxshi" degani, "bu tugma" degani emas. Bir ekranda
bittadan ortiq to'yingan (to'ldirilgan) rang bo'lmasin — aks holda ko'z "qaysi
biri asosiy?" degan savolga javob topmaydi.

---

## 2. Tipografika

Shrift: **Inter**. Boshqa shrift qo'shilmaydi.

Ildiz o'lchami **16px**. Hozir 14px — shuning uchun barcha `rem` o'lchamlari
0.875 ga ko'payib, kasrli piksellar chiqadi (`10.5px`, `12.25px`) va ekranda
xiralashadi.

| Nom | O'lcham / qator | Vazn | Qachon |
|---|---|---|---|
| `display` | 24 / 32 | 600 | katta raqam (balans, jami summa) |
| `h1` | 20 / 28 | 600 | sahifa sarlavhasi |
| `h2` | 16 / 24 | 600 | karta sarlavhasi, bo'lim nomi |
| `h3` | 14 / 20 | 600 | karta ichidagi nom, jadval ichidagi ism |
| `body` | 14 / 20 | 400 | asosiy matn |
| `body-md` | 14 / 20 | 500 | ta'kidlangan asosiy matn |
| `label` | 13 / 18 | 500 | maydon yorlig'i |
| `caption` | 12 / 16 | 400 | izoh, sana, yordamchi matn |
| `overline` | 11 / 16 | 600 | jadval sarlavhasi, badge |

**Eng kichik o'lcham 11px** va u faqat `overline` uchun. Hozir `10.5px` matn
421 ta elementda ishlatilgan — bu o'qish chegarasidan past.

### Bosh harf (UPPERCASE) qoidasi

Faqat **ikki joyda** ruxsat: jadval sarlavhasi (`th`) va badge.

Boshqa hamma joy — Sentence case. Sahifa taglik matni, tugma, tab, karta
sarlavhasi, maydon yorlig'i.

Hozir shunday: `XOMASHYO VA MATERIALLAR NAZORATI`, `BARCHA HAMKORLAR VA
ULARNING MOLIYAVIY HOLATI` — bular taglik matnlar, ular sarlavhadan ham
ko'zga ko'proq tashlanadi, holbuki ikkinchi darajali. Va bir xil tugma bir
sahifada `EKSPORT`, boshqasida `Eksport`.

### Raqamlar

Pul, miqdor, sana — hammasi `tabular-nums` bilan va o'ngga tekislangan.
Shunda jadvalda raqamlar tik ustun bo'lib turadi va solishtirish oson.

---

## 3. O'lcham va bo'shliq

### Boshqaruv balandligi — uchta

| Nom | Balandlik | Qachon |
|---|---|---|
| `sm` | 32px | jadval ichi, zich toolbar |
| `md` | 36px | standart — hamma joyda shu |
| `lg` | 44px | mobil, asosiy CTA |

Hozir beshta boshqa balandlik bor: 21, 28, 30, 36, 45px.

### Burchak radiusi — uchta

| Nom | Qiymat | Qachon |
|---|---|---|
| `control` | 8px | tugma, input, select, chip, ikonka-tugma |
| `card` | 12px | karta, panel, kanban ustuni |
| `overlay` | 16px | modal, dropdown, popover |
| `full` | dumaloq | avatar, badge, status nuqtasi |

Hozir olti xil radius ishlatilgan (3.5 / 10 / 12 / 14 / 18 / 24). Aybdor
dasturchi emas — **ro'yxat**: oltita radius tokeni e'lon qilingan, u oltitasini
ham ishlatgan.

### Bo'shliq

4 ning karrasi: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64.
Oradagi qiymat (`7px`, `13px`, `18px`) ishlatilmaydi.

### Soya

| Nom | Qachon |
|---|---|
| `xs` | karta (juda yengil) |
| `sm` | faol tab, ko'tarilgan element |
| `md` | hover'dagi karta, dropdown |
| `lg` | modal, yon panel |

**Karta = ramka**, soya emas. Soya faqat "suzuvchi" narsaga: modal, dropdown,
sudrab yurilayotgan karta.

---

## 4. Tugma

Beshta variant, uchta o'lcham. Boshqa tugma yo'q.

| Variant | Ko'rinishi | Qachon |
|---|---|---|
| `primary` | to'q sariq fon, oq matn | ekrandagi **bitta** asosiy harakat |
| `secondary` | oq fon, kulrang ramka | qolgan hamma harakat |
| `ghost` | fon yo'q, hover'da yengil fon | ikonka-tugma, uchinchi darajali |
| `success` | oq fon, **yashil matn va ramka** | Kirim, tasdiqlash |
| `danger` | oq fon, **qizil matn va ramka** | Chiqim, o'chirish |
| `danger-solid` | to'ldirilgan qizil | faqat o'chirishni **tasdiqlash** oynasida |

> **Nega `success` va `danger` to'ldirilmaydi:** hozir Kassa toolbar'ida uchta
> to'yingan fon bor — to'q sariq (Yangi kassa) + yashil (Kirim) + qizil (Chiqim).
> Ko'z uchalasini bir xil "muhim" deb o'qiydi va qaysi biri asosiy ekanini
> ajratmaydi. Rang matn va ramkada qolsa, ma'no saqlanadi, shovqin yo'qoladi.

**Bitta ekranda faqat bitta `primary`.** Ikkinchi muhim harakat bo'lsa —
`secondary`.

### Holatlar

| Holat | Nima o'zgaradi |
|---|---|
| normal | asosiy ko'rinish |
| hover | fon bir pog'ona to'qlashadi, 120ms |
| active | yana bir pog'ona to'q, harakat yo'q (sakramaydi) |
| focus | 2px to'q sariq halqa, 2px oraliq bilan |
| disabled | shaffoflik 45%, kursor o'zgarmaydi, bosilmaydi |
| loading | matn joyida qoladi, chap ikonka o'rniga aylanuvchi spinner |

`loading` holatida **tugma o'lchami o'zgarmaydi** va tugma bosilmaydi. Matnni
"Yuklanmoqda..." ga almashtirmaydi — sakrash bo'lmasligi uchun.

### Ikonka-tugma

Kvadrat: eni = balandligi. Ichidagi ikonka 18px. `aria-label` majburiy —
ikonkaning o'zi nima qilishini aytmaydi.

---

## 5. Maydon (input)

### Umumiy — hamma maydon uchun bir xil

Barcha kiritish elementlari bitta qutida: matn, raqam, telefon, pul, sana,
select, textarea, qidiruv. Ular **bir xil** balandlik, radius, ramka va
ichki bo'shliqqa ega.

- Balandlik `md` (36px), ichki bo'shliq 12px, radius `control`
- **Foni har doim oq** (`--bg-surface`)
- Ramka `--border`, hover'da `--border-strong`
- Focus: ramka to'q sariq + 3px yumshoq halqa
- Placeholder `--subtle-foreground`
- Disabled: fon yengil kulrang, kursor `not-allowed`

> **Maydon rangli bo'lmaydi.** Hozir formalarda uch xil input bor: ba'zisi
> oq, ba'zisi kulrang, buyurtma formasidagilar esa sarg'ish-to'q sariq fonli
> va rangli ramkali. Rang faqat ikki holatda paydo bo'ladi: **focus** (to'q
> sariq halqa) va **xato** (qizil ramka). Boshqa paytda hamma maydon bir xil oq.

### Yorliq, izoh, xato

Har bir maydonda: **yorliq** (13px, 500) → **maydon** → ostida **izoh** yoki
**xato**. Izoh va xato bir vaqtda ko'rsatilmaydi — xato izohni almashtiradi.
Xato paytida maydon **joyini o'zgartirmaydi** (sakramaydi).

> **Xato faqat maydondan chiqilgandan (blur) yoki Saqlash bosilgandan keyin
> ko'rsatiladi.** Hozir forma ochilishi bilan qizil yozuv chiqib turadi —
> foydalanuvchi hech narsaga tegmagan, lekin unga "sen xato qilding" deyilyapti.

### Maydon turlari

Har bir tur o'z qoidasiga ega. "Oddiy matn maydoni" deb qo'yib yuborilmaydi.

#### Telefon — O'zbekiston

Eng ko'p ishlatiladigan va hozir eng noqulay maydon.

- `+998` **doim ko'rinib turadi** va maydonning o'zgarmas qismi. Foydalanuvchi
  uni yozmaydi va o'chira olmaydi
- Foydalanuvchi faqat 9 ta raqam kiritadi
- Yozayotganda o'zi guruhlanadi: `+998 90 123 45 67`
- Telefonda **raqamli klaviatura** ochiladi
- Nusxa-joylashtirish ishlaydi: `998901234567`, `+998 90 123 45 67`,
  `90 123 45 67` — uchalasi ham to'g'ri tushunilsin
- To'liq bo'lmasa xato: "Telefon raqami to'liq emas"
- Saqlashda bitta formatda saqlanadi, ekranda guruhlangan holda ko'rsatiladi

> **Bazadagi eski yozuvlarga tegilmaydi** (2026-08-17 qarori). Faqat yangi
> kiritilayotgan raqamlar bir xil formatda saqlanadi. Eski aralash yozuvlarni
> tozalash — alohida ish.

#### Pul

- Yozayotganda bo'shliq bilan guruhlanadi: `8 300 000`
- O'ngga tekislangan, raqamlar tik ustun bo'lib turadi
- O'ng chekkada valyuta yozuvi (`UZS`)
- Telefonda raqamli klaviatura
- Faqat raqam qabul qiladi, harf yozilmaydi

#### Miqdor / son

- Faqat butun son, o'ngga tekislangan
- O'ng chekkada birlik yozuvi (`dona`, `m²`, `sm`) — xizmatdan keladi
- Telefonda raqamli klaviatura

#### Sana

- Brauzerning o'z sana maydoni **ishlatilmaydi**. Sababi: u brauzer tilidan
  format oladi va hozir o'zbekcha tizimda ruscha `дд.мм.гггг` chiqib turadi
- Format: `kun.oy.yil`, oy nomlari o'zbekcha
- Yonida kalendar ikonkasi, bosilsa kalendar ochiladi
- Ko'p ishlatiladigan variantlar tugma bo'lib turishi mumkin: Bugun, Ertaga

#### Select

- Brauzer standart strelkasi emas, o'z ikonkasi — har OS'da bir xil ko'rinsin
- Variantlar 7 tadan ko'p bo'lsa — ichida qidiruv bo'lsin
- Tanlanmagan holat aniq ko'rinsin: `— Tanlang —`

#### Qidiruvli select (combobox)

- Chapda qidiruv ikonkasi, yozganda ro'yxat filtrlanadi
- Variant yonida qo'shimcha ma'lumot bo'lishi mumkin (narx, qarz miqdori)
- Ro'yxatda topilmasa — pastda "yangi qo'shish" imkoni bo'lsin, foydalanuvchi
  formadan chiqmasin

#### Qidiruv maydoni

- Chapda ikonka, matn kiritilganda o'ngda tozalash tugmasi
- Yozish tugagach qidiradi (har harfda emas)

#### Textarea

- Balandligi o'zgaruvchan, pastki o'ng burchakdan cho'zish mumkin
- Eng kam balandlik: 3 qator

### Mobil klaviatura

Telefonda har bir maydon **to'g'ri klaviaturani** ochishi kerak: raqam uchun
raqamli, telefon uchun telefon, email uchun email. Bu Telegram ichida
ishlaydigan foydalanuvchi uchun sezilarli farq.

---

## 6. Yuklanish holatlari (loading)

Beshta turli holat, har biri o'z o'rnida. Aralashtirilmaydi.

### 6.1 Spinner — faqat kichik joyda

Aylanuvchi doira, 1 aylanish 800ms, chiziq qalinligi asosiy matn bilan bir xil.
Ishlatiladi: tugma ichida, kichik panel ichida.

**Sahifa o'rtasida katta spinner ishlatilmaydi** — u foydalanuvchiga nima
yuklanayotganini aytmaydi va kutish uzoqroq tuyuladi.

### 6.2 Skeleton — kontent shakli oldindan ko'rinsin

Ro'yxat, jadval, karta va KPI yuklanayotganda o'sha narsaning **shakli**
ko'rsatiladi: kulrang to'rtburchaklar, haqiqiy element o'lchamida.

- Rangi: `--n-100` dan `--n-200` gacha yumshoq pulsatsiya, 1.5s, cheksiz
- Shakli haqiqiy kontent bilan bir xil bo'lsin — yuklangach sakrash bo'lmasin
- Ro'yxatda 3–5 ta qator ko'rsatiladi, ko'p emas

Hozir Kanban skeleton'i bor va u to'g'ri ishlangan — shu yondashuv hamma
ro'yxatga tarqatiladi.

### 6.3 Tugma ichida

Yuqorida yozilgan: spinner ikonka o'rnini oladi, matn qoladi, o'lcham
o'zgarmaydi, tugma bosilmaydi.

### 6.4 Jadval yangilanishi (allaqachon kontent bor)

Ma'lumot bor, lekin filtr o'zgardi va qayta yuklanyapti — **jadval
o'chirilmaydi**. Eski kontent joyida qoladi, ustiga 50% shaffoflik tushadi va
tepada ingichka progress chizig'i yuguradi. Shunda ekran "bo'shab" ketmaydi.

### 6.5 Saqlash / yuborish

Tugma `loading` holatiga o'tadi. Muvaffaqiyat bo'lsa — toast xabar. Xato bo'lsa
— toast **va** aloqador maydonda xato. Panel yoki modal faqat muvaffaqiyatdan
keyin yopiladi.

### Umumiy qoida

150ms dan tez tugaydigan ish uchun loading ko'rsatilmaydi — miltillash
noqulaylik tug'diradi. 150ms dan uzun bo'lsa ko'rsatiladi.

---

## 7. Bo'sh holat (empty state)

Bo'sh ro'yxat "Ma'lumot yo'q" degan kulrang yozuv bo'lmasin. Uchta qism:
yumshoq ikonka, bitta qatorli sarlavha, bir-ikki qatorli tushuntirish, va
imkoni bo'lsa keyingi qadam tugmasi.

Misol: hozir Kassada "Xarajatlar yo'q" deb turadi. O'rniga: ikonka +
"Xarajat yo'q" + "Bu davrda hech qanday chiqim qayd etilmagan" +
"Xarajat qo'shish" tugmasi.

> **Tugma qoidasi** (2026-08-17 qarori): bo'sh holatga tugma qo'shish MUMKIN,
> lekin faqat o'sha harakat **o'sha sahifada allaqachon bor** bo'lsa. Ya'ni bu
> yangi funksiya emas, borining yorlig'i. Sahifada bunday harakat bo'lmasa —
> faqat ikonka va matn.

Xato holati ham shu shaklda: nima bo'lganini aytadi va "Qayta urinish" beradi.

---

## 8. Boshqa komponentlar

### Badge — faqat holat uchun

Dumaloq, 22px balandlik, 11px bosh harfli matn, chap tomonida kichik nuqta.
Ranglar 1-bo'limdagi holat jadvalidan. Bezak uchun ishlatilmaydi.

### Tabs — bitta uslub

Kulrang qutichada joylashgan tugmalar, faol bo'lgani oq fon va yengil soya
oladi. Matn **Sentence case**. Ikonka bo'lishi mumkin, lekin bo'lsa hamma
tabda bo'lsin.

Hozir uchta boshqa tab uslubi bor: Kanbanda bir xil, Omborda ikonka +
UPPERCASE bilan, Mijozlarda ikonkasiz.

### StatCard — bitta ko'rinish

Tepada yorliq va yumshoq fondagi ikonka, o'rtada katta raqam, pastda izoh yoki
o'zgarish foizi.

Hozir Kassa, Mijozlar va Ombor sahifalarida **uchta boshqa-boshqa** KPI karta
bor. Uchalasi bittaga keladi.

**Hisoblanadigan qiymat alohida karta bo'lmaydi.** Balans = Kirim − Chiqim
bo'lsa, uchta emas, ikkita karta kerak.

### Jadval

Sarlavha qatori: 11px bosh harfli, yengil kulrang fon. Qatorlar orasida
ingichka chiziq. Hover'da qator yengil rang oladi. Raqamlar o'ngda va tik
ustun bo'lib turadi. Amallar ustuni eng o'ngda, ikonka-tugmalar bilan.

### Modal va yon panel

- **Modal** — qisqa, bitta qaror: o'chirishni tasdiqlash, bitta maydonni
  o'zgartirish
- **Yon panel** — uzun forma, ko'p maydon, aylantirish kerak bo'ladigan holat

Ikkalasida ham: orqa fon xiralashadi, `Esc` bilan yopiladi, fonga bosilsa
yopiladi, tasdiqlash tugmalari doim ko'rinib turadi.

> **Diqqat:** xiralashtiruvchi qatlam panel **ostida** turishi kerak. Aks holda
> u panel ustiga tushib, ichidagi hamma narsa xira va so'nik ko'rinadi.

### Toast

O'ng yuqorida, 4 soniya. Muvaffaqiyat yashil, xato qizil, ma'lumot ko'k.
Bir vaqtda uchtadan ortiq ko'rinmaydi.

---

## 9. Ikonka

Bitta to'plam — **Lucide**. Boshqa ikonka to'plami qo'shilmaydi.

- Chiziq qalinligi hamma joyda bir xil: `1.75`
- O'lchamlar: 16px (tugma ichida), 18px (ikonka-tugma, menyu), 20px (bo'sh holat,
  bo'lim sarlavhasi)
- Rangi matndan meros oladi, o'zi rang belgilamaydi

Hozir saytda 152 ta ikonka bor va ular 12 xil o'lcham-qalinlik
kombinatsiyasida.

---

## 10. Harakat (motion)

| Nima | Davomiylik |
|---|---|
| hover, focus, rang o'zgarishi | 120ms |
| panel/modal ochilishi, karta ko'tarilishi | 180ms |
| skeleton pulsatsiyasi | 1.5s, cheksiz |
| spinner aylanishi | 800ms, cheksiz |

Egri chiziq: boshida tez, oxirida yumshoq (`cubic-bezier(.2,.8,.2,1)`).

- 180ms dan uzun animatsiya yo'q — ilova sekin tuyuladi
- Element **joyini** almashtiradigan animatsiya yo'q, faqat rang, shaffoflik va
  yengil siljish
- Tinch holatda elementga `transform` qo'yib qo'yilmaydi — matn xiralashadi
- Foydalanuvchi tizimda animatsiyani o'chirgan bo'lsa (`prefers-reduced-motion`)
  animatsiyalar ishlamaydi

---

## 11. Klaviatura va focus

- Har bir bosiladigan element `Tab` bilan yetib boradigan bo'lsin
- Focus halqasi hamma joyda **bir xil**: 2px to'q sariq, 2px oraliq bilan
- Focus halqasini o'chirib qo'yish taqiqlanadi
- Modal/panel ochilganda focus ichkariga kiradi, yopilganda qaytadi
- `Esc` modal va panelni yopadi

---

## 12. Mobil va Telegram

Ilova Telegram Mini App sifatida ham ochiladi — ya'ni ko'p foydalanuvchi buni
telefonda, barmoq bilan ishlatadi.

- 640px dan pastda barcha tugma va input balandligi **44px**
- Bosiladigan joylar orasida kamida 8px bo'shliq
- Jadvallar mobilda gorizontal aylanadi yoki kartaga aylanadi — matn kichraymaydi
- Yon panel mobilda butun ekranni egallaydi
- Hover'ga tayangan funksiya bo'lmasin — barmoqda hover yo'q

---

## 13. Loyihadagi mavjud lug'at

Bu bo'lim eski `DESIGN.md` dan ko'chirildi (u o'chirildi — ikkita hujjat
bo'lsa biri albatta yolg'on bo'ladi). Bu yerda **nishon emas, mavjud holat**
yozilgan: qaysi klass nomlari allaqachon bor va butun kodda ishlatiladi.

### Manba fayllar

- `frontend/src/index.css` — `:root` tokenlari va `@layer components`
- `frontend/tailwind.config.js` — tokenlarning Tailwind'ga bog'lanishi

### Mavjud klass nomlari — O'ZGARMAYDI

Bu nomlar butun kod bo'ylab ishlatilgan. Ular **saqlanadi**, faqat ortidagi
qiymatlar shu hujjatga moslanadi:

| Guruh | Klasslar |
|---|---|
| Tugma | `btn-primary` `btn-success` `btn-danger` `btn-outline` `btn-ghost` (+ `h-sm` / `h-lg`), `icon-btn` |
| Maydon | `input-minimal` `select-minimal` `textarea-minimal` |
| Matn | `page-title` `card-title` `form-label` `label-caps` `text-hint` |
| Jadval | `table-minimal` |
| Badge | `badge-success` `badge-danger` `badge-primary` `badge-neutral` |
| Karta | `card-minimal` |

> **Token nomlari ham o'zgarmaydi** (2026-08-17 qarori): `--primary`,
> `--border`, `--foreground` va boshqalar shu nomda qoladi, faqat qiymatlari
> shu hujjatdagiga almashadi. Yuqoridagi jadvallarda `--brand-600` kabi nomlar
> **rolni** bildiradi, faylda qanday atalishini emas. Hujjatda bor, lekin kodda
> yo'q rollar (masalan `--subtle-foreground`) yangi qo'shiladi.

### Layout

- Shell: sidebar 288px, header 56px oq, kontent padding 12–24px
- Responsivelik strukturaviy: sidebar mobilda overlay, jadval gorizontal
  scroll konteynerda, toolbar `flex-wrap`
- **Sahifa sarlavhasi sahifa ichida TAKRORLANMAYDI** — u shell headerda turadi;
  sahifa faqat toolbar va kontent beradi

**Siqiladigan yon menyu** (2026-08-19): desktopda menyu 288px ↔ 72px o'rtasida
almashadi. Siqilganda faqat ikonkalar qoladi (nomi tooltip'da), guruh
sarlavhalari yashirinadi, yangilik soni kichik nuqtaga aylanadi. Tanlov
`localStorage: pf_sidebar_collapsed` da saqlanadi. Mobil drawer o'zgarmaydi —
u har doim to'liq kenglikda ochiladi.

**Yon panellar overlay emas, tarkib qismi.** AI chat paneli 1280px (xl) dan
boshlab yon menyu kabi joyda turadi va kontentni siqadi — orqa fonni
xiralashtirmaydi, ustiga tushmaydi. Sabab: chat bilan ishlash paytida
foydalanuvchi kontentni ham ko'rib turadi; xiralashtirilgan fon esa "modal
ochiq, ishing to'xtadi" degan xabar beradi. Xiralashtirish faqat haqiqiy
modal uchun (bitta qaror, tasdiqlash).

### Ma'lum kolliziya — landing CSS

`index.css` oxirida legacy landing-page CSS bor (`.section-title` 3rem va
hokazo). **Dizayn-tizim klasslariga o'sha nomlar berilmaydi** — aynan shu
sabab `card-title` deb nomlangan. Landing CSS'iga tegilmaydi.

---

## Tekshiruv

Ish tugagach brauzer konsolida:

```js
const vis=[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});
const u=a=>[...new Set(a)].length, cs=e=>getComputedStyle(e);
console.table({
  root_font:        cs(document.documentElement).fontSize,
  kasrli_olchamlar: vis.map(e=>cs(e).fontSize).filter(s=>s.includes('.')).length,
  radiuslar:        u(vis.map(e=>cs(e).borderRadius).filter(r=>r!=='0px')),
  matn_olchamlari:  u(vis.map(e=>cs(e).fontSize)),
  tugma_balandligi: u([...document.querySelectorAll('button')].filter(b=>b.offsetHeight).map(b=>b.offsetHeight)),
});
```

| Ko'rsatkich | Boshlang'ich | Maqsad |
|---|---|---|
| `root_font` | 14px | 16px |
| `kasrli_olchamlar` | 976 | 0 |
| `radiuslar` | 6 | ≤ 4 |
| `matn_olchamlari` | 4 (hammasi kasrli) | ≤ 7 |
| `tugma_balandligi` | 5 | ≤ 4 |

Qo'shimcha, qo'lda tekshiriladi:

- [ ] Barcha maydonlar oq fonli, bir xil balandlik va ramkada
- [ ] Telefon maydonida `+998` doim turibdi va o'chirilmaydi
- [ ] Pul va miqdor maydonlari o'ngga tekislangan, raqamli klaviatura ochadi
- [ ] Sana maydonida ruscha format yo'q
- [ ] Hech bir maydon ochilishi bilan qizil xato ko'rsatmaydi
