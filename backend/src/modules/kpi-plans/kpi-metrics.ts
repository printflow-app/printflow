// =============================================
// KPI METRIKA REGISTRY (data-driven)
// Har org shu ro'yxatdan metrika tanlab, target qo'yadi. Yangi tayyor metrika
// qo'shish = shu massivga 1 ta yozuv + computeMetricValues ichida hisoblash.
// (2-bosqichda org o'zi yaratadigan "custom/manual" metrikalar qo'shiladi.)
// Hammasi "yuqori = yaxshi" yo'nalishida (target — yetish kerak bo'lgan maqsad).
// =============================================

export type MetricKey =
  | 'orders_taken'
  | 'orders_completed'
  | 'units_produced'
  | 'revenue'
  | 'on_time_days'
  | 'activity';

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  hint: string;
}

export const BUILTIN_METRICS: MetricDef[] = [
  { key: 'orders_taken',     label: 'Olingan buyurtma',     unit: 'ta',      hint: 'Xodim olgan (yaratgan) buyurtmalar soni' },
  { key: 'orders_completed', label: 'Bitirilgan buyurtma',  unit: 'ta',      hint: 'Xodim bajarib oxirgi bosqichga yetkazgan buyurtmalar' },
  { key: 'units_produced',   label: 'Ishlab chiqarilgan miqdor', unit: 'dona', hint: 'Bitirilgan buyurtmalarning umumiy miqdori (soni)' },
  { key: 'revenue',          label: 'Tushum',               unit: "so'm",    hint: 'Xodim olgan buyurtmalarning umumiy summasi' },
  { key: 'on_time_days',     label: 'Vaqtida kelgan kunlar',unit: 'kun',     hint: 'Kechikmasdan kelgan ish kunlari' },
  { key: 'activity',         label: 'Faollik',              unit: 'harakat', hint: "Tizimdagi harakatlar (yaratish/ko'chirish/tahrir) soni" },
];

export const METRIC_KEYS: MetricKey[] = BUILTIN_METRICS.map((m) => m.key);

export function isValidMetric(key: string): key is MetricKey {
  return (METRIC_KEYS as string[]).includes(key);
}

export type MetricValues = Record<MetricKey, number>;

export function emptyMetricValues(): MetricValues {
  return { orders_taken: 0, orders_completed: 0, units_produced: 0, revenue: 0, on_time_days: 0, activity: 0 };
}
