// Local (shop-time) dates. `new Date().toISOString()` is UTC, so in India it reports
// yesterday between midnight and 05:30, which broke "today" in Finance and Day Close.
const pad = (n) => String(n).padStart(2, '0');

export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localDateTimeStr(d = new Date()) {
  return `${localDateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
