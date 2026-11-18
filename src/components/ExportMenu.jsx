import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { exportTable } from '../lib/exportUtils.js';

/**
 * Export dropdown (Excel / PDF).
 * getSpec: () => ({ title, headers, rows, filename })  - called when a format is chosen.
 * onDone(message): optional callback (e.g. toast).
 */
export default function ExportMenu({ getSpec, onDone, className = '', label = 'Export' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const run = async (format) => {
    setOpen(false);
    setBusy(true);
    try {
      const spec = getSpec();
      await exportTable(format, spec);
      onDone && onDone(`Exported ${spec.rows.length} record${spec.rows.length === 1 ? '' : 's'} to ${format === 'pdf' ? 'PDF' : 'Excel'}.`);
    } catch (err) {
      onDone && onDone(`Export failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className={
          className ||
          'flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-60'
        }
      >
        <Download className="w-3.5 h-3.5 text-slate-500" />
        <span>{busy ? 'Exporting...' : label}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1 text-xs">
          <button type="button" onClick={() => run('xlsx')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700 font-semibold">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel (.xlsx)
          </button>
          <button type="button" onClick={() => run('pdf')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700 font-semibold">
            <FileText className="w-4 h-4 text-red-600" /> PDF
          </button>
        </div>
      )}
    </div>
  );
}
