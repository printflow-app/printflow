# Design

PrintFlow vizual tizimi — **Linear-professional** (2026-07 redizayn). Register: product.
Manba: `frontend/src/index.css` (:root tokenlar + @layer components) va `frontend/tailwind.config.js`.

## Color

| Token | Qiymat | Vazifa |
|---|---|---|
| `--background` | `#f7f8f9` | Kontent foni (sovuq neytral) |
| `--surface-2` | `#fcfcfd` | Sidebar/panel qatlami (`bg-surface2`) |
| `--card` | `#ffffff` | Kartalar, jadvallar, modallar |
| `--primary` | `#f2610d` | FAQAT asosiy amal/tanlov/holat — bezak emas |
| `--border` / `--border-strong` | `#e5e7ea` / `#d3d6db` | Ajratkichlar |
| `--foreground` | `#18181b` | Asosiy matn |
| Semantik | emerald-600 (kirim/success), rose-600 (chiqim/danger), amber (ogohlantirish) | Holat ranglari; "series 4" sifatida ishlatilmaydi |

## Typography

Inter (webfont) + system fallback. Bitta oila, og'irlik bilan ierarxiya.

- Bazaviy matn: 13-14px (`html` 14px)
- `page-title` 18px semibold — shell headerdagi sahifa nomi (sahifa ichida takrorlanmaydi)
- `card-title` 15px semibold — karta/bo'lim sarlavhasi
- `form-label` 12px medium — forma yorlig'i, normal registr
- `label-caps` 11px medium caps — FAQAT jadval ustuni sarlavhasi (uppercase'ning yagona ruxsat joyi, badge'dan tashqari)
- `text-hint` 12px slate-500 — izoh
- TAQIQ: 12px dan kichik matn (badge 11px istisno), uppercase tugma/sarlavha, italic sarlavha, font-black

## Radius & Spacing

`--radius-*` tokenlari tailwind `rounded-{sm..3xl}` ga remap qilingan: 5/7/9/10/12/16px.
Tugma/inputlar `rounded-lg` (9px). Karta `rounded-xl` (10px). Pill (rounded-full) faqat avatar/badge.
Control balandligi: `h-control` 36px desktop / 40px mobil (≤640px media), `h-control-sm` 30/34, `h-control-lg` 44/48.

## Components (index.css @layer components)

- **Tugmalar** — yagona lug'at, har tugma shulardan biri: `btn-primary` `btn-success` `btn-danger` `btn-outline` `btn-ghost` (+ `h-sm`/`h-lg` modifikator), `icon-btn` (32px kvadrat). 13px, normal registr, whitespace-nowrap.
- **Forma**: `input-minimal` `select-minimal` `textarea-minimal` — oq fon, border token, orange focus ring 2px.
- **Jadval**: `table-minimal` — th `label-caps` uslubda, td 13px.
- **Badge**: `badge-success|danger|primary|neutral` — 12px semibold pill, normal registr matn bilan.
- **Karta**: `card-minimal` yoki `bg-white border border-[color:var(--border)] rounded-xl`.

## Motion

150-250ms, ease-out; holat o'zgarishi uchun, bezak uchun emas. `active:scale-[0.98]` tugmalarda. Sahifa yuklanish xoreografiyasi yo'q. prefers-reduced-motion hurmat qilinadi.

## Layout

- Shell: sidebar 288px (`bg-surface2`), header 56px oq; kontent padding 12-24px.
- Responsivelik strukturaviy: sidebar overlay (mobil), jadval gorizontal scroll konteynerda, toolbar flex-wrap.
- Sahifa ichida sahifa sarlavhasi TAKRORLANMAYDI — u shell headerda; sahifa faqat toolbar/kontent beradi.

## Migratsiya holati (2026-07-06)

Yangi tizimda: shell (Dashboard), Modal, Topshiriqlar (kanban yuzasi + asosiy modal), Kassa, TaskBadges.
Eski uslubda qolgan: Sozlamalar, Ombor, Mijozlar, Hodimlar, Hamkorlar, Davomat, Hisobotlar, Moliya, Admins, Filiallar, Billing, AICopilot ichki kartalar (qisman mos). Yangi kod HAR DOIM yuqoridagi klasslardan foydalanadi; inline px-o'lcham va uppercase yozish taqiqlangan.

## Ma'lum kolliziya

`index.css` oxirida legacy landing-page CSS bor (`.section-title` 3rem va h.k.) — dizayn-tizim klasslariga o'sha nomlarni BERMANG (shu sabab `card-title` deb nomlangan). Landing keyinroq alohida faylga ko'chirilishi kerak.
