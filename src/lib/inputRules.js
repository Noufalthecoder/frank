// App-wide input rules. Installed once (see main.jsx); fields opt in with a data-rule attribute.
//   type="number" (automatic)  digits and one decimal point only; no e / + / - (minus only if min < 0)
//   data-int                   number field that takes whole numbers only
//   data-rule="alpha"          letters (any language), spaces . ' -
//   data-rule="text"           letters, digits, spaces and common punctuation (no emoji / stray symbols)
//   data-rule="phone"          digits, + - ( ) and space
//   data-rule="digits"         digits only
//   data-rule="code"           A-Z 0-9 and hyphen, upper-cased (rack codes, GSTIN, SKU)
// Number fields also select their content on focus, so typing replaces a default value
// instead of producing "010".

const RULES = {
  alpha: (s) => s.replace(/[^\p{L}\p{M} .'’-]/gu, ''),
  text: (s) => s.replace(/[^\p{L}\p{M}\p{N} .,'’"&/()+#%:;@_×*-]/gu, ''),
  phone: (s) => s.replace(/[^0-9+\-() ]/g, ''),
  digits: (s) => s.replace(/\D/g, ''),
  code: (s) => s.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
};

function cleanFor(el, text) {
  if (!el || el.tagName !== 'INPUT') return null;
  if (el.type === 'number') {
    const allowMinus = el.min !== '' && Number(el.min) < 0;
    const allowDot = !el.hasAttribute('data-int');
    let out = text.replace(allowMinus ? /[^0-9.\-]/g : /[^0-9.]/g, '');
    if (!allowDot) out = out.replace(/\./g, '');
    return out;
  }
  const rule = el.getAttribute('data-rule');
  return rule && RULES[rule] ? RULES[rule](text) : null;
}

function onBeforeInput(e) {
  const el = e.target;
  if (typeof e.data !== 'string' || !e.data) return; // deletions, undo etc.
  if (e.inputType && !/^insert(Text|FromPaste|FromDrop|ReplacementText)$/.test(e.inputType)) return;
  const cleaned = cleanFor(el, e.data);
  if (cleaned === null || cleaned === e.data) return;
  e.preventDefault();
  if (cleaned) {
    try { document.execCommand('insertText', false, cleaned); } catch { /* ignore */ }
  }
}

function onFocusIn(e) {
  const el = e.target;
  if (el && el.tagName === 'INPUT' && el.type === 'number' && !el.readOnly && !el.disabled) {
    // Defer so the click that focused the field does not clear the selection.
    setTimeout(() => { try { el.select(); } catch { /* ignore */ } }, 0);
  }
}

// Stop the mouse wheel from silently changing a focused number field.
function onWheel(e) {
  const el = document.activeElement;
  if (el && el.tagName === 'INPUT' && el.type === 'number' && el === e.target) el.blur();
}

let installed = false;
export function installInputRules() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('wheel', onWheel, { passive: true, capture: true });
}
