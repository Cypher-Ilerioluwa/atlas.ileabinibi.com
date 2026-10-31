// Data saver: for slow or expensive connections. Turns off animation and decorative pictures, and asks before loading the map.
// It switches on by itself when the phone's own data-saver setting is on, and can be switched with the footer button.
const KEY = 'atlas-data-saver';
export function dataSaverOn() {
  try { const v = localStorage.getItem(KEY); if (v === '1') return true; if (v === '0') return false; } catch { /* ignore */ }
  return Boolean(navigator.connection?.saveData);
}
const apply = () => { document.documentElement.dataset.saver = dataSaverOn() ? '1' : '0'; };
function sync() {
  const b = document.getElementById('ds-toggle'); if (!b) return;
  const on = dataSaverOn(); b.setAttribute('aria-pressed', on); b.textContent = `Data saver: ${on ? 'on' : 'off'}`;
}
export function setDataSaver(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ } apply(); sync(); }
apply();
const links = document.querySelector('.foot-links');
if (links) { const b = Object.assign(document.createElement('button'), { type: 'button', id: 'ds-toggle', className: 'ds-toggle' }); b.addEventListener('click', () => setDataSaver(!dataSaverOn())); links.append(b); sync(); }
