# Product

## Register

product

## Users

O'zbekistondagi poligrafiya korxonalari (bosmaxonalar) — va kelgusida boshqa xizmat bizneslari (avto servis rejalashtirilgan). Ikki asosiy foydalanuvchi:

- **Egasi/Admin** — kuning ko'p qismini desktop'da o'tkazadi: kassa, hisobotlar, xodimlar, sozlamalar. Moliyaviy aniqlik va nazorat uning asosiy ehtiyoji.
- **Xodimlar** (kassir, dizayner, pechatchi, menejer) — ko'pincha telefonda (PWA, Telegram WebApp): buyurtma holatini ko'chirish, davomat QR, o'z vazifalarini ko'rish.

Ikkala qurilma sinfi teng huquqli: har ekran o'lchamida to'liq ishlashi shart.

Til: o'zbek (lotin). Texnik jargon emas, sodda ish tili.

## Product Purpose

PrintFlow — buyurtma (kanban), kassa, mijoz/qarz, ombor, davomat va KPI'ni bitta joyda boshqaradigan multi-tenant SaaS. Hozir "Agent as a Service" ga aylanmoqda: Girgitton agenti (omnibox, generative UI kartalar, avtonom brifing/eslatmalar) asosiy ish usuliga aylanadi, sahifalar "manual rejim" bo'lib qoladi.

Muvaffaqiyat: egasi ertalab brifingdan kunni boshlaydi, xodim telefonida ikki bosishda ishini qiladi, hech kim "bu tugma qayerda" deb o'ylamaydi.

## Brand Personality

**Ishonchli, tartibli, tezkor.** Linear/Stripe dashboard'lari darajasidagi professional zichlik: interfeys vazifa ichida ko'rinmas bo'lib ketadi. Girgitton (agent) — yagona "shaxsiyatli" qatlam; qolgan hamma narsa xizmat qiladi, ko'z-ko'z qilmaydi.

## Anti-references

- **"Average CRM/ERP" ko'rinishi** — foydalanuvchining aniq talabi: shunga o'xshamasin.
- **Hozirgi holatning o'zi anti-reference:** 300+ tugma har xil (balandlik 8/10/11/12/14/16, radius xl/2xl/full/[2rem], uppercase+tracking-widest hamma joyda); 1000+ o'zboshimcha px o'lcham (text-[7px]..text-[10px] mikro-matn epidemiyasi); italic-uppercase sarlavhalar.
- Ko'z uradigan bezak: gradient matn, glassmorphism, shadow-ko'rgazma.
- O'yinchoq ko'rinish: haddan ortiq yumaloq burchaklar + pastel har joyda.

## Design Principles

1. **Bitta lug'at — hamma joyda.** Bir xil vazifa = bir xil komponent. "Saqlash" tugmasi ikki sahifada ikki xil ko'rinsa, bittasi xato.
2. **Zichlik — hurmat.** Foydalanuvchi kuniga yuzlab yozuv ko'radi; katta bo'sh kartalar emas, o'qiladigan zich jadval/ro'yxatlar. 13-14px asosiy matn, aniq ierarxiya.
3. **Uppercase — istisno, qoida emas.** Mikro-uppercase-tracking faqat jadval sarlavhasi va badge'da; sarlavha va tugmalar normal registrda.
4. **Rang holat uchun, bezak uchun emas.** Orange = asosiy amal/tanlov; emerald/rose/amber = semantik holat; qolgani neytral.
5. **Har ekran haqiqiy.** 360px telefondan 1440px monitorgacha — gorizontal scroll yo'q, yashiringan funksiya yo'q; strukturaviy responsivelik (sidebar collapse, jadval → karta).

## Accessibility & Inclusion

- Minimal matn o'lchami 12px (istisno: badge 11px); 8px/7px matn taqiqlanadi.
- Tap target ≥ 40px telefonda.
- Kontrast WCAG AA (matn 4.5:1); rang yolg'iz ma'no tashimaydi (ikon/label bilan).
- prefers-reduced-motion hurmat qilinadi; animatsiyalar 150-250ms, holat uchun.
