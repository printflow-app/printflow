import * as XLSX from 'xlsx';

// Bitta jadval (sheet) bilan .xlsx fayl yaratib brauzer orqali yuklaydi.
// columns'da har bir ustun uchun: header (sarlavha) va accessor (qator → qiymat).
export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

export interface ExportSheet<T> {
  sheetName: string;
  rows: T[];
  columns: ExportColumn<T>[];
}

function buildSheet<T>(rows: T[], columns: ExportColumn<T>[]): XLSX.WorkSheet {
  const aoa: (string | number | null | undefined)[][] = [
    columns.map((c) => c.header),
    ...rows.map((r) => columns.map((c) => c.accessor(r))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((_, idx) => {
    const maxLen = aoa.reduce((m, row) => {
      const v = row[idx];
      return Math.max(m, v == null ? 0 : String(v).length);
    }, 0);
    return { wch: Math.min(60, Math.max(10, maxLen + 2)) };
  });
  return ws;
}

export function exportToXlsx<T>(opts: {
  filename: string;
  sheetName?: string;
  rows: T[];
  columns: ExportColumn<T>[];
}): void {
  const { filename, sheetName = 'Sheet1', rows, columns } = opts;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(rows, columns), sheetName);
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

// Bir necha jadval bitta .xlsx faylga — har biri o'z sheet'i sifatida.
// Bo'sh rows bilan sheet'lar ham yoziladi (faqat header qatori bo'ladi),
// agar buni xohlamasangiz, chaqirayotgan tomon filter qilsin.
export function exportMultiSheetXlsx(opts: {
  filename: string;
  sheets: ExportSheet<any>[];
}): void {
  const { filename, sheets } = opts;
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    // Excel sheet nomi 31 belgidan oshmasligi kerak + maxsus belgilar taqiqlangan
    const safeName = s.sheetName.replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || 'Sheet';
    XLSX.utils.book_append_sheet(wb, buildSheet(s.rows, s.columns), safeName);
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
