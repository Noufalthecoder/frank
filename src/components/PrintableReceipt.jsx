import React from 'react';
import { formatQty, isMeasurableUnit } from '../lib/units.js';
import {
  getPrintPreferences,
  getPaperSpec,
  amountToIndianWords,
  formatBillDate,
} from '../lib/printConfig.js';

export { getPrintPreferences };

export function InvoiceDocument({ invoice, profile, format, inlinePreview = false }) {
  if (!invoice) return null;

  const prefs = getPrintPreferences();
  const spec = getPaperSpec(format || prefs.format);
  const isThermal = spec.thermal;
  const isNarrow = spec.id === '58mm' || spec.id === '80mm';

  const items = Array.isArray(invoice.items)
    ? invoice.items
    : (() => {
        try {
          return JSON.parse(invoice.items_json || '[]');
        } catch (_) {
          return [];
        }
      })();

  const shopName = profile?.shop_name || 'T. S. P Enterprises';
  const addressParts = [
    profile?.address_line1 || 'Beach Road',
    profile?.address_line2 || 'Tharuvaikulam',
    profile?.city || 'Thoothukudi',
    profile?.pincode || '628105',
  ].filter(Boolean);
  const phone = profile?.phone || '+91 98765 43210';
  const termsText =
    profile?.invoice_footer || 'Goods once sold will not be taken back.';

  const subtotal = Number(invoice.subtotal ?? invoice.total ?? 0);
  const discount = Number(invoice.discount || 0);
  const grandTotal = Number(invoice.total ?? Math.max(0, subtotal - discount));
  const amountWords = amountToIndianWords(grandTotal);
  const billNo = String(invoice.invoice_number || 'INV-0001').replace(/^#/, '');
  const billDate = formatBillDate(invoice.date_time || invoice.date);

  // Proportional font sizing from A1 (large sheet) down to 58mm thermal
  const baseFontPx = inlinePreview
    ? isNarrow
      ? spec.id === '58mm'
        ? 10
        : 11
      : 12
    : Math.round(12 * spec.fontScale);

  const headingPx = Math.round(baseFontPx * (isNarrow ? 1.25 : 1.35));
  const pad = isNarrow ? '8px 6px' : '18px 22px';

  return (
    <div
      style={{
        fontFamily: '"JetBrains Mono", "Courier New", Courier, monospace',
        color: '#0f172a',
        backgroundColor: '#ffffff',
        fontSize: `${baseFontPx}px`,
        lineHeight: 1.5,
        padding: pad,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Double Rule + Header */}
      <div
        style={{
          borderTop: '3px double #0f172a',
          borderBottom: '3px double #0f172a',
          padding: isNarrow ? '6px 0' : '10px 0',
          marginBottom: isNarrow ? '8px' : '14px',
        }}
      >
        {isNarrow ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: `${headingPx}px`, fontWeight: 800, letterSpacing: '0.4px' }}>
              {shopName.toUpperCase()}
            </div>
            <div style={{ fontSize: `${Math.max(8, baseFontPx - 1)}px`, marginTop: '2px' }}>
              {addressParts.join(', ')}
            </div>
            <div style={{ fontSize: `${Math.max(8, baseFontPx - 1)}px` }}>
              Phone: {phone}
            </div>
            <div
              style={{
                marginTop: '6px',
                paddingTop: '4px',
                borderTop: '1px dashed #64748b',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
              }}
            >
              <span>Bill: #{billNo}</span>
              <span>{billDate}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ fontSize: `${headingPx}px`, fontWeight: 800, letterSpacing: '0.4px' }}>
                {shopName.toUpperCase()}
              </div>
              <div style={{ marginTop: '2px' }}>{addressParts.join(', ')}</div>
              <div>Phone: {phone}</div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: `${Math.round(baseFontPx * 1.15)}px`, fontWeight: 800, letterSpacing: '0.8px' }}>
                INVOICE / BILL
              </div>
              <div style={{ marginTop: '2px', fontWeight: 700 }}>Bill No: #{billNo}</div>
              <div>Date: {billDate}</div>
            </div>
          </div>
        )}
      </div>

      {/* BILL TO */}
      <div style={{ marginBottom: isNarrow ? '8px' : '14px' }}>
        <div style={{ fontWeight: 700, letterSpacing: '0.4px' }}>BILL TO:</div>
        <div>
          Customer Name: <strong>{invoice.customer_name || 'Walk-in Customer'}</strong>
        </div>
        {invoice.customer_phone ? (
          <div>Address / Phone: {invoice.customer_phone}</div>
        ) : (
          <div>Address / Phone: —</div>
        )}
      </div>

      {/* Itemized Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          borderTop: '1px dashed #0f172a',
          borderBottom: '1px dashed #0f172a',
          marginBottom: isNarrow ? '8px' : '10px',
          fontSize: `${isNarrow ? Math.max(8, baseFontPx - 1) : baseFontPx}px`,
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px dashed #0f172a' }}>
            <th style={{ textAlign: 'left', padding: '5px 4px 5px 0', width: '24px' }}>#</th>
            <th style={{ textAlign: 'left', padding: '5px 6px', borderLeft: '1px solid #cbd5e1' }}>
              ITEM / DESCRIPTION
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '5px 6px',
                borderLeft: '1px solid #cbd5e1',
                whiteSpace: 'nowrap',
              }}
            >
              QTY
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '5px 6px',
                borderLeft: '1px solid #cbd5e1',
                whiteSpace: 'nowrap',
              }}
            >
              RATE
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '5px 0 5px 6px',
                borderLeft: '1px solid #cbd5e1',
                whiteSpace: 'nowrap',
              }}
            >
              AMOUNT
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '10px 0', textAlign: 'center' }}>
                {invoice.items_count || 1} item(s) billed
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const qtyVal = item.quantity ?? item.qty ?? 1;
              const unitStr = item.unit ? ` ${item.unit}` : '';
              const rateUnit =
                item.base_unit && isMeasurableUnit(item.base_unit) ? `/${item.base_unit}` : '';
              const amt = Number(
                item.total ?? (item.stock_deduction_qty || qtyVal) * (item.rate || 0)
              );
              return (
                <tr key={idx}>
                  <td style={{ padding: '4px 4px 4px 0', verticalAlign: 'top' }}>{idx + 1}</td>
                  <td
                    style={{
                      padding: '4px 6px',
                      borderLeft: '1px solid #e2e8f0',
                      verticalAlign: 'top',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '4px 6px',
                      borderLeft: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'top',
                    }}
                  >
                    {formatQty(qtyVal)}
                    {unitStr}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '4px 6px',
                      borderLeft: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'top',
                    }}
                  >
                    {Number(item.rate || 0).toFixed(2)}
                    {rateUnit}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '4px 0 4px 6px',
                      borderLeft: '1px solid #e2e8f0',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      verticalAlign: 'top',
                    }}
                  >
                    {amt.toFixed(2)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Totals Block */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          borderBottom: '1px dashed #0f172a',
          paddingBottom: isNarrow ? '6px' : '8px',
          marginBottom: isNarrow ? '8px' : '12px',
        }}
      >
        <table style={{ borderCollapse: 'collapse', minWidth: isNarrow ? '100%' : '230px' }}>
          <tbody>
            <tr>
              <td style={{ textAlign: 'right', padding: '2px 8px 2px 0' }}>SUBTOTAL:</td>
              <td
                style={{
                  textAlign: 'right',
                  padding: '2px 0 2px 8px',
                  borderLeft: '1px solid #cbd5e1',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                ₹ {subtotal.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'right', padding: '2px 8px 2px 0' }}>DISCOUNT:</td>
              <td
                style={{
                  textAlign: 'right',
                  padding: '2px 0 2px 8px',
                  borderLeft: '1px solid #cbd5e1',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {discount > 0 ? `- ₹ ${discount.toFixed(2)}` : '0.00'}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  textAlign: 'right',
                  padding: '4px 8px 2px 0',
                  fontWeight: 800,
                  fontSize: `${Math.round(baseFontPx * 1.1)}px`,
                }}
              >
                GRAND TOTAL:
              </td>
              <td
                style={{
                  textAlign: 'right',
                  padding: '4px 0 2px 8px',
                  borderLeft: '1px solid #0f172a',
                  fontWeight: 800,
                  fontSize: `${Math.round(baseFontPx * 1.1)}px`,
                  whiteSpace: 'nowrap',
                }}
              >
                ₹ {grandTotal.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Amount in Words */}
      <div style={{ marginBottom: isNarrow ? '8px' : '12px' }}>
        <span>Amount in Words: </span>
        <strong>{amountWords}</strong>
      </div>

      {/* Payment Method & Terms */}
      <div style={{ marginBottom: isNarrow ? '12px' : '20px' }}>
        <div>
          Payment Method: <strong>{invoice.payment_mode || 'Cash'}</strong>
        </div>
        <div>Terms: {termsText}</div>
      </div>

      {/* Signatory & Bottom Double Rule */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '12px',
          paddingBottom: isNarrow ? '6px' : '10px',
          borderBottom: '3px double #0f172a',
          flexWrap: isNarrow ? 'wrap' : 'nowrap',
        }}
      >
        <div style={{ fontWeight: 600 }}>Thank you for your business!</div>
        {!isThermal && (
          <div style={{ textAlign: 'center', minWidth: '160px' }}>
            <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 600 }}>
              Authorized Signatory
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PrintableReceipt({ invoice, profile, format }) {
  if (!invoice) return null;
  const prefs = getPrintPreferences();
  const spec = getPaperSpec(format || prefs.format);

  return (
    <div className={`print-receipt print-format-${spec.id.toLowerCase()}`}>
      <InvoiceDocument invoice={invoice} profile={profile} format={spec.id} inlinePreview={false} />
    </div>
  );
}
