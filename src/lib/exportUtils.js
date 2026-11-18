// Shared table export helpers: Excel (.xlsx) and PDF.
// Libraries are loaded lazily so they don't slow down app start.

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isNumeric = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * @param {{title: string, headers: string[], rows: Array<Array<string|number>>, filename: string}} spec
 *  filename without extension. Numbers stay numbers in Excel; PDF prints everything as text.
 */
export async function exportToExcel({ title, headers, rows, filename }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(String(title).slice(0, 31).replace(/[\/?*[\]:]/g, ' '));

  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  head.alignment = { vertical: 'middle' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  headers.forEach((h, idx) => {
    const col = ws.getColumn(idx + 1);
    const longest = rows.reduce((m, r) => Math.max(m, String(r[idx] ?? '').length), String(h).length);
    col.width = Math.min(Math.max(longest + 2, 10), 50);
    if (rows.length && rows.every((r) => r[idx] === '' || r[idx] == null || isNumeric(r[idx]))) {
      col.alignment = { horizontal: 'right' };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`
  );
}

export async function exportToPdf({ title, headers, rows, filename, subtitle }) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const landscape = headers.length > 6;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });

  doc.setFontSize(14);
  doc.text(String(title), 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(subtitle || `Generated ${new Date().toLocaleString()}  |  ${rows.length} record${rows.length === 1 ? '' : 's'}`, 40, 56);

  autoTable(doc, {
    startY: 70,
    head: [headers],
    body: rows.map((r) => r.map((c) => (c == null ? '' : String(c)))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [29, 78, 216] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const pg = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`Page ${pg}`, doc.internal.pageSize.getWidth() - 70, doc.internal.pageSize.getHeight() - 20);
    },
  });

  doc.save(`${filename}.pdf`);
}

export async function exportTable(format, spec) {
  if (format === 'pdf') return exportToPdf(spec);
  return exportToExcel(spec);
}
