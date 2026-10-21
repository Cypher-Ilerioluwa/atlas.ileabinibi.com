import { loadCommunities } from './api.js';
import { matches, esc } from './search.js';
import { toast } from './shell.js';
import { setCrumbs } from './core.js';
setCrumbs([['Home', '/'], ['Map']]);

const EV = { documented: 'Documented', oral_tradition: 'Oral tradition', scholarly_interpretation: 'Scholarly interpretation', disputed: 'Disputed account', community_submitted: 'Community submitted', under_review: 'Under review' };
const PALETTE = ['#3C2414', '#DCA43C', '#5C3C1C', '#9B6A1E', '#7A4E07', '#B9803A'];
const $ = id => document.getElementById(id);
const state = { q: '', region: 'All', sel: null };
let places = [], map, layer, markers = new Map(), mapReady = false, demo = false;
const colourFor = r => PALETTE[[...new Set(places.map(p => p.region))].indexOf(r) % PALETTE.length];

const params = new URLSearchParams(location.search);
state.q = params.get('q') || ''; state.region = params.get('region') || 'All'; state.sel = params.get('place');
$('q').value = state.q;

const visible = () => places.filter(p => (state.region === 'All' || p.region === state.region) && matches([p.preferred_name, p.alt, p.country, p.region, p.summary], state.q));
const badge = k => `<span class="badge ${esc(k)}">${esc(EV[k] || k)}</span>`;

function drawChips() {
  const regions = ['All', ...new Set(places.map(p => p.region))];
  $('regions').innerHTML = regions.map(v => `<button type="button" class="chip" data-v="${esc(v)}" aria-pressed="${state.region === v}">${v === 'All' ? 'All regions' : esc(v)}</button>`).join('');
}
function syncUrl() {
  const u = new URLSearchParams(); if (state.q) u.set('q', state.q); if (state.region !== 'All') u.set('region', state.region); if (state.sel) u.set('place', state.sel);
  history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));
}
function renderDetail() {
  const p = places.find(x => x.slug === state.sel), d = $('detail');
  if (!p) { d.innerHTML = '<h2 style="font-size:var(--step-1)">Choose a community</h2><p>Select a name in the list or a point on the map to see where it is, its history and key information.</p>'; return; }
  const where = p.lat != null ? `<p class="small muted">${demo ? 'Approximate city-centre point' : 'Mapped point'}: ${p.lat.toFixed(2)}, ${p.lng.toFixed(2)} · <a href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=11/${p.lat}/${p.lng}" rel="noopener">OpenStreetMap</a></p>` : '<p class="small muted">The exact location is withheld.</p>';
  d.innerHTML = `<h2 style="font-size:var(--step-2)">${esc(p.preferred_name)}</h2>
    <p class="muted small">${p.alt ? 'Also: ' + esc(p.alt) + ' · ' : ''}${esc(p.country)}</p>
    <p>${badge(p.evidence)}</p>
    <h3 style="font-size:var(--step-0)">History and key information</h3>
    <p>${esc(p.summary || 'No summary has been published yet.')}</p>
    ${demo ? '<p class="notice">Demonstration entry, not yet editorially reviewed.</p>' : ''}
    ${where}
    <p><a class="btn" href="/city/?c=${encodeURIComponent(p.slug)}">View Community</a> <button class="btn btn-ghost" type="button" id="share">Copy link</button></p>`;
  $('share').onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast('Link copied.'); } catch { toast('Copy failed. Copy the address bar link instead.'); } };
}
function renderList(list) {
  $('count').textContent = `${list.length} of ${places.length} communities shown`;
  $('list').innerHTML = list.length ? list.map(p => `<li><button type="button" data-id="${esc(p.slug)}" ${p.slug === state.sel ? 'aria-current="true"' : ''}><b>${esc(p.preferred_name)}</b><small>${esc(p.country)}</small></button></li>`).join('')
    : '<li class="empty" style="grid-column:1/-1"><h3>No communities match</h3><p>Try fewer letters, or clear the region filter.</p></li>';
}
function renderMap(list) {
  if (!mapReady) return; layer.clearLayers(); markers.clear();
  list.filter(p => p.lat != null && p.lng != null).forEach(p => {
    const icon = L.divIcon({ className: '', html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${colourFor(p.region)};border:3px solid #FCF4E4;box-shadow:0 0 0 1.5px #3C2414"></span>`, iconSize: [18, 18] });
    const m = L.marker([p.lat, p.lng], { icon, title: p.preferred_name, alt: p.preferred_name, keyboard: true });
    m.bindPopup(`<strong>${esc(p.preferred_name)}</strong><br>${esc(p.country)}<br><button type="button" class="chip" data-open="${esc(p.slug)}">Read more</button>`);
    m.on('click', () => select(p.slug, false)); layer.addLayer(m); markers.set(p.slug, m);
  });
}
function render() { const list = visible(); drawChips(); renderList(list); renderDetail(); renderMap(list); syncUrl(); }
function select(slug, fly = true) {
  state.sel = slug; render(); const p = places.find(x => x.slug === slug);
  if (mapReady && p && p.lat != null && fly) map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 7), { duration: .6 });
}
function fit() {
  if (!mapReady) return; const l = visible().filter(p => p.lat != null); if (!l.length) return;
  map.fitBounds(L.latLngBounds(l.map(p => [p.lat, p.lng])).pad(.2), { maxZoom: 8, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
}
$('q').addEventListener('input', e => { state.q = e.target.value; render(); });
$('regions').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { state.region = b.dataset.v; render(); fit(); } });
$('list').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { select(b.dataset.id); $('detail').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } });
document.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) select(b.dataset.open); });

const loadScript = (src, integrity) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; if (integrity) { s.integrity = integrity; s.crossOrigin = ''; } s.onload = res; s.onerror = () => rej(new Error('load failed')); document.head.append(s); });
async function initMap() {
  try {
    await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js');
    map = L.map('map', { worldCopyJump: true }).setView([7.8, 4], 6);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    let warned = false; tiles.on('tileerror', () => { if (!warned) { warned = true; toast('Map tiles could not load. The list and entries still work.', 6000); } });
    layer = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 40 }).addTo(map);
    mapReady = true; render(); fit();
    const m = state.sel && markers.get(state.sel); if (m) map.setView(m.getLatLng(), 8);
  } catch { $('map').innerHTML = '<p class="map-fallback"><strong>The map could not load.</strong> Check your connection and reload. The community list still works.</p>'; }
}
(async () => {
  try { const r = await loadCommunities(); places = r.rows; demo = r.demo; $('demo-note').hidden = !demo; }
  catch (e) { $('list').innerHTML = `<li class="empty" style="grid-column:1/-1"><h3>Could not load communities</h3><p>${esc(e.message)}</p></li>`; }
  $('listload').hidden = true;
  if (places.length === 0 && !demo) $('list').innerHTML = '<li class="empty" style="grid-column:1/-1"><h3>No communities published yet</h3><p>Reviewed communities will appear here.</p></li>';
  else render();
  initMap();
})();
