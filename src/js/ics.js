// "Add to calendar": builds a standard .ics file (works with Apple, Google, Outlook) and a Google Calendar link.
const pad = n => String(n).padStart(2, '0');
const ymd = iso => String(iso).slice(0, 10).replace(/-/g, '');
function dayAfter(iso) { const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; }
const stamp = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
export const icsEscape = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 bytes must be folded: continue on the next line, starting with one space. */
export function fold(line) {
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '', bytes = 0;
  for (const ch of line) { const b = enc.encode(ch).length; if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += b; }
  out.push(cur); return out.join('\r\n ');
}

/** An all-day event (start and optional end are dates like 2026-10-14). */
export function buildIcs({ uid, title, start, end, location, description, url, now = new Date() }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ilẹ̀ Abínibí Atlas//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${uid}@atlas.ileabinibi.com`, `DTSTAMP:${stamp(now)}`, `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${dayAfter(end || start)}`, `SUMMARY:${icsEscape(title)}`];
  if (location) lines.push(`LOCATION:${icsEscape(location)}`);
  const desc = [description, url].filter(Boolean).join('\n\n'); if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
  if (url) lines.push(`URL:${url}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
export function googleCalUrl({ title, start, end, location, description, url }) {
  const e = encodeURIComponent;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${e(title)}&dates=${ymd(start)}/${dayAfter(end || start)}&details=${e([description, url].filter(Boolean).join('\n\n'))}&location=${e(location || '')}`;
}
export function downloadFile(filename, text, type = 'text/calendar;charset=utf-8') {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: filename });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
