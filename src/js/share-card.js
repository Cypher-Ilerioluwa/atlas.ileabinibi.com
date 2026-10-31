// "Share as picture": draws a branded 1080 x 1350 card (title, short text, logo, address) and shares or downloads it.
// People share pictures on WhatsApp and Instagram far more than links.
const W = 1080, H = 1350;
const SERIF = '"Noto Serif", Georgia, "Times New Roman", serif', SANS = '"Source Sans 3", system-ui, "Segoe UI", Roboto, sans-serif';

/** Break text into at most maxLines lines that fit maxW, ending with … if it had to be cut. */
export function wrapLines(measure, text, maxW, maxLines) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean), lines = []; let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? cur + ' ' + words[i] : words[i];
    if (measure(next) <= maxW) { cur = next; continue; }
    if (cur) lines.push(cur); cur = words[i];
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  const used = lines.join(' ').split(' ').length;
  if (used < words.length && lines.length) { let l = lines[lines.length - 1]; while (l.length > 1 && measure(l + '…') > maxW) l = l.slice(0, -1).trimEnd(); lines[lines.length - 1] = l.replace(/[,.;:!?-]+$/, '') + '…'; }
  return lines;
}
const loadImage = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export async function makeCard({ kicker = '', title = '', body = '', footer = 'atlas.ileabinibi.com' } = {}) {
  try { await Promise.all([document.fonts.load(`700 70px ${SERIF}`), document.fonts.load(`400 36px ${SANS}`), document.fonts.load(`700 30px ${SANS}`)]); } catch { /* fonts are optional */ }
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3c2414'); g.addColorStop(1, '#6a3d22'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // sun and rays
  const cx = 900, cy = 250; x.save(); x.translate(cx, cy);
  for (let i = 0; i < 36; i++) { x.rotate(Math.PI / 18); x.fillStyle = 'rgba(221,166,60,.07)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(1500, -40); x.lineTo(1500, 40); x.closePath(); x.fill(); }
  x.restore(); x.fillStyle = '#dda63c'; x.beginPath(); x.arc(cx, cy, 90, 0, 7); x.fill(); x.strokeStyle = 'rgba(221,166,60,.4)'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, 118, 0, 7); x.stroke();
  // hills
  x.fillStyle = '#2a190d'; x.beginPath(); x.moveTo(0, H); x.lineTo(0, 1190); x.bezierCurveTo(260, 1120, 520, 1260, 760, 1190); x.bezierCurveTo(900, 1150, 1000, 1190, W, 1170); x.lineTo(W, H); x.fill();
  x.fillStyle = '#1b1008'; x.beginPath(); x.moveTo(0, H); x.lineTo(0, 1260); x.bezierCurveTo(300, 1210, 600, 1300, W, 1240); x.lineTo(W, H); x.fill();
  // logo
  const logo = await loadImage('/assets/img/logo.png');
  if (logo) { x.save(); x.beginPath(); x.roundRect?.(80, 80, 120, 120, 26); if (!x.roundRect) x.rect(80, 80, 120, 120); x.clip(); x.drawImage(logo, 80, 80, 120, 120); x.restore(); }
  x.fillStyle = '#fff7e8'; x.font = `700 34px ${SERIF}`; x.textBaseline = 'alphabetic'; x.fillText('Ilẹ̀ Abínibí Atlas', 222, 150);
  x.fillStyle = '#dda63c'; x.font = `400 26px ${SANS}`; x.fillText('Mapping Our Roots', 222, 188);
  // text
  let y = 340;
  if (kicker) { x.fillStyle = '#dda63c'; x.font = `700 30px ${SANS}`; if ('letterSpacing' in x) x.letterSpacing = '4px'; x.fillText(String(kicker).toUpperCase().slice(0, 40), 80, y); if ('letterSpacing' in x) x.letterSpacing = '0px'; y += 70; }
  x.fillStyle = '#fff7e8'; x.font = `700 74px ${SERIF}`;
  for (const l of wrapLines(s => x.measureText(s).width, title, W - 160, 5)) { x.fillText(l, 80, y); y += 92; }
  y += 24; x.fillStyle = '#f0e1c8'; x.font = `400 38px ${SANS}`;
  const room = Math.max(1, Math.floor((1010 - y) / 56));
  for (const l of wrapLines(s => x.measureText(s).width, body, W - 160, Math.min(7, room))) { x.fillText(l, 80, y); y += 56; }
  // footer
  x.fillStyle = '#fff7e8'; x.font = `700 34px ${SANS}`; x.fillText(footer, 80, H - 70);
  x.fillStyle = 'rgba(255,247,232,.7)'; x.font = `400 26px ${SANS}`; x.fillText('Connecting Our People', 80, H - 30);
  return new Promise(res => c.toBlob(res, 'image/png'));
}

/** Share the picture with the phone's share sheet (WhatsApp, Instagram...), or download it. Returns 'shared' | 'downloaded' | 'cancelled'. */
export async function sharePicture(card, filename, { title = '', text = '', url = '' } = {}) {
  const blob = await makeCard(card); if (!blob) throw new Error('Could not make the picture.');
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title, text: [text, url].filter(Boolean).join('\n') }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; } }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
