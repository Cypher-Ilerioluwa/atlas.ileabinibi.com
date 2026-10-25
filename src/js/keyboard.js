// Keeps inputs usable above the on-screen keyboard, like a messenger.
// --vvh = the visible height, --kb = keyboard height. Chat and forms use them so the text box stays on top of the keyboard.
const root = document.documentElement, vv = window.visualViewport;
function update() {
  const h = vv ? vv.height : innerHeight, top = vv ? vv.offsetTop : 0, kb = Math.max(0, Math.round(innerHeight - h - top));
  root.style.setProperty('--vvh', h + 'px'); root.style.setProperty('--vvt', top + 'px'); root.style.setProperty('--kb', kb + 'px');
  document.body.classList.toggle('kb-open', kb > 120);
}
if (vv) { vv.addEventListener('resize', update); vv.addEventListener('scroll', update); }
addEventListener('resize', update); update();
const typing = el => el && (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable) && !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(el.type);
document.addEventListener('focusin', e => {
  const el = e.target; if (!typing(el)) return;
  // after the keyboard has opened, bring the field into view (chat composers manage themselves)
  setTimeout(() => { if (!el.closest('.cx-compose')) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); else document.querySelector('.cx-log')?.scrollTo({ top: 1e9 }); }, 320);
});
document.addEventListener('focusout', () => setTimeout(() => { if (!typing(document.activeElement)) window.scrollTo({ top: scrollY, behavior: 'instant' }); }, 100));
