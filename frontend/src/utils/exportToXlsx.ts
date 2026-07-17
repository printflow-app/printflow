import XLSX from 'xlsx-js-style';

// Bitta jadval (sheet) bilan .xlsx fayl yaratib brauzer orqali yuklaydi.
// columns'da har bir ustun uchun: header (sarlavha) va accessor (qator → qiymat).
//   type='number' — hujayra haqiqiy son bo'ladi (numFmt bo'yicha formatlanadi,
//                    standart: "#,##0" — mingliklar ajratuvchisi bilan).
//   type='text'/undefined — matn hujayra.
export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  type?: 'text' | 'number';
  numFmt?: string; // masalan "#,##0" yoki "#,##0.00"
}

export interface ExportSheet<T> {
  sheetName: string;
  rows: T[];
  columns: ExportColumn<T>[];
}

// Stillar — header uchun to'q ko'k fon + oq qalin matn, body uchun nozik border + markazlash.
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
} as const;

const HEADER_STYLE = {
  font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { patternType: 'solid', fgColor: { rgb: '1E40AF' } }, // to'q ko'k
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '1E3A8A' } },
    bottom: { style: 'thin', color: { rgb: '1E3A8A' } },
    left: { style: 'thin', color: { rgb: '1E3A8A' } },
    right: { style: 'thin', color: { rgb: '1E3A8A' } },
  },
};

const BODY_STYLE = {
  font: { name: 'Calibri', sz: 11, color: { rgb: '0F172A' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: THIN_BORDER,
};

// Juft qatorlar uchun engil zebra-fon — o'qishni osonlashtiradi.
const BODY_STYLE_ALT = {
  ...BODY_STYLE,
  fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
};

function isNumeric(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function buildSheet<T>(rows: T[], columns: ExportColumn<T>[]): XLSX.WorkSheet {
  const aoa: (string | number | null | undefined)[][] = [
    columns.map((c) => c.header),
    ...rows.map((r) => columns.map((c) => c.accessor(r))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Har bir hujayraga to'g'ri TUR (son/matn), FORMAT va STIL berish.
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const value = aoa[r][c];
      if (!ws[cellRef]) {
        ws[cellRef] = { t: 's', v: '' };
      }

      if (r === 0) {
        ws[cellRef].s = HEADER_STYLE;
        continue;
      }

      // Tanani hujayrasi — son bo'lsa haqiqiy raqam + format, aks holda matn.
      const wantsNumber = col.type === 'number' || (col.type === undefined && isNumeric(value));
      const base = r % 2 === 0 ? BODY_STYLE_ALT : BODY_STYLE;

      if (wantsNumber && isNumeric(value)) {
        const cell = ws[cellRef];
        cell.t = 'n';
        cell.v = value;
        cell.z = col.numFmt || '#,##0'; // mingliklar ajratuvchisi bilan
        cell.s = { ...base, alignment: { ...base.alignment, horizontal: 'right' } };
      } else {
        ws[cellRef].s = base;
      }
    }
  }

  // Ustun kengligi — eng uzun matnga qarab.
  ws['!cols'] = columns.map((_, idx) => {
    const maxLen = aoa.reduce((m, row) => {
      const v = row[idx];
      return Math.max(m, v == null ? 0 : String(v).length);
    }, 0);
    return { wch: Math.min(60, Math.max(12, maxLen + 2)) };
  });

  // Header qatori biroz balandroq.
  ws['!rows'] = aoa.map((_, idx) => ({ hpt: idx === 0 ? 24 : 20 }));

  // AVTOFILTR — sarlavha qatoriga filtr tugmalari qo'shadi (haqiqiy "jadval" hissi).
  // Diapazon: A1'dan oxirgi ustun/qatorgacha.
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(0, aoa.length - 1), c: columns.length - 1 },
    }),
  };

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
