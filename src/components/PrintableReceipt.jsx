import React from 'react';
import { formatQty, isMeasurableUnit } from '../lib/units.js';

export function getPrintPreferences() {
  try {
    const raw = localStorage.getItem('tsp_print_prefs');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { format: 'thermal', autoPrint: false };
}

export default function PrintableReceipt({ invoice, profile }) {
  if (!invoice) return null;

  const prefs = getPrintPreferences();
  const isThermal = prefs.format !== 'a4';

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
  const tagline = profile?.tagline || 'Hardware, Tools & Fasteners';
  const addressParts = [
    profile?.address_line1 || 'Beach Road',
    profile?.address_line2 || 'Tharuvaikulam',
    profile?.city || 'Thoothukudi',
    profile?.pincode || '628105',
  ].filter(Boolean);
  const phone = profile?.phone || '+91 98765 43210';
  const footer =
    profile?.invoice_footer ||
    'Thank you for your business! Goods once sold cannot be returned without bill.';

  return (
    <div className={`print-receipt ${isThermal ? 'receipt-thermal' : 'receipt-a4'}`}>
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
        <div style={{ fontSize: isThermal ? '15px' : '20px', fontWeight: 800, letterSpacing: '0.3px' }}>
          {shopName}
        </div>
        <div style={{ fontSize: isThermal ? '10px' : '12px', marginTop: '2px' }}>{tagline}</div>
        <div style={{ fontSize: isThermal ? '10px' : '11px', marginTop: '2px' }}>
          {addressParts.join(', ')}
        </div>
        <div style={{ fontSize: isThermal ? '10px' : '11px', marginTop: '2px' }}>Ph: {phone}</div>
      </div>

      <div style={{ fontSize: isThermal ? '10px' : '12px', marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Bill No: <strong>{invoice.invoice_number}</strong></span>
          <span>Mode: <strong>{invoice.payment_mode || 'Cash'}</strong></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span>Date: {invoice.date || invoice.date_time || new Date().toLocaleString()}</span>
        </div>
        <div style={{ marginTop: '2px' }}>
          Customer: <strong>{invoice.customer_name || 'Walk-in Customer'}</strong>
          {invoice.customer_phone ? ` (${invoice.customer_phone})` : ''}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isThermal ? '10px' : '12px', marginBottom: '8px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
            <th style={{ textAlign: 'center', padding: '4px 4px' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '4px 4px' }}>Rate</th>
            <th style={{ textAlign: 'right', padding: '4px 0' }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '6px 0', textAlign: 'center' }}>
                {invoice.items_count || 1} item(s) billed
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const qtyVal = item.quantity || item.qty || 1;
              const unitStr = item.unit ? ` ${item.unit}` : '';
              const rateUnit = item.base_unit && isMeasurableUnit(item.base_unit) ? `/${item.base_unit}` : '';
              return (
                <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '4px 2px 4px 0' }}>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.sku && <div style={{ fontSize: '9px' }}>{item.sku}</div>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '4px', whiteSpace: 'nowrap' }}>
                    {formatQty(qtyVal)}{unitStr}
                  </td>
                  <td style={{ textAlign: 'right', padding: '4px', whiteSpace: 'nowrap' }}>
                    {Number(item.rate || 0).toFixed(2)}{rateUnit}
                  </td>
                  <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>
                    {Number(item.total ?? (item.stock_deduction_qty || qtyVal) * (item.rate || 0)).toFixed(2)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', fontSize: isThermal ? '11px' : '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Subtotal</span>
          <span>₹ {Number(invoice.subtotal || invoice.total || 0).toFixed(2)}</span>
        </div>
        {Number(invoice.discount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Discount</span>
            <span>- ₹ {Number(invoice.discount).toFixed(2)}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 800,
            fontSize: isThermal ? '14px' : '16px',
            borderTop: '1px solid #000',
            paddingTop: '4px',
            marginTop: '4px',
          }}
        >
          <span>TOTAL</span>
          <span>₹ {Number(invoice.total || 0).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed #000', fontSize: isThermal ? '9px' : '11px' }}>
        <div>{footer}</div>
      </div>
    </div>
  );
}
