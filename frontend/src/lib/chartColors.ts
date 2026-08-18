// =============================================
// GRAFIK RANGLARI (Recharts va boshqa vizualizatsiyalar uchun)
//
// DESIGN-SYSTEM.md §1 dagi holat ranglariga bog'langan. Grafikda rang
// semantikaga ergashadi: kirim = success, chiqim = danger, asosiy
// ko'rsatkich = brend orange. Sahifalarda xom hex yozilmaydi.
// =============================================

export const chartColors = {
  primary: '#ea580c', // brend — asosiy seriya
  success: '#059669', // kirim, o'sish
  danger: '#dc2626', // chiqim, kamayish
  warning: '#d97706', // ogohlantirish
  info: '#2563eb', // qo'shimcha ma'lumot seriyasi
  neutral: '#a8a29e', // yordamchi seriya
  neutralDark: '#57534e',
  grid: '#e7e2db', // to'r chiziqlari (--border)
  axis: '#a8a29e', // o'q yozuvlari (--subtle-foreground)
} as const;

/** Semantikasi yo'q ko'p-seriyali grafiklar uchun tartiblangan palitra */
export const chartSeries: string[] = [
  chartColors.primary,
  chartColors.neutralDark,
  chartColors.info,
  chartColors.success,
  chartColors.warning,
  chartColors.neutral,
];
