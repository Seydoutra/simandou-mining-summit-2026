/**
 * Simandou motion layer — DOM-side motion design that sits on top of the React app.
 * Never restructures React-owned nodes: it only toggles classes, CSS variables and
 * text values, and keeps its own overlay elements outside #root.
 */
const BASE = '/simandou-mining-summit-2026';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const paused = () => { try { return localStorage.getItem('sms26-motion-paused') === '1'; } catch { return false; } };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lang = () => (document.documentElement.lang || 'fr').slice(0, 2);
const T = {
 fr: { speed: 'VITESSE', dist: 'DISTANCE', cargo: 'CHARGE', from: 'SIMANDOU', to: 'MOREBAYA', route: 'CORRIDOR TRANSGUINÉEN', live: 'EN DIRECT' },
 en: { speed: 'SPEED', dist: 'DISTANCE', cargo: 'PAYLOAD', from: 'SIMANDOU', to: 'MOREBAYA', route: 'TRANS-GUINEAN CORRIDOR', live: 'LIVE' },
 zh: { speed: '速度', dist: '里程', cargo: '载重', from: '西芒杜', to: '莫雷巴亚', route: '跨几内亚铁路走廊', live: '实时' },
};
const t = () => T[lang()] || T.fr;

/* ------------------------------------------------------------------ CSS */
const css = `
:root{--mx-green:#00a26a;--mx-glow:#31d6a0;--mx-copper:#e3893e;--mx-deep:#02090d}
.mx-progress{position:fixed;left:0;top:0;height:2px;width:100%;z-index:9998;pointer-events:none;transform-origin:0 50%;transform:scaleX(var(--p,0));background:linear-gradient(90deg,var(--mx-green),var(--mx-glow) 60%,var(--mx-copper));box-shadow:0 0 12px var(--mx-glow),0 0 2px #fff}
.mx-grain{position:fixed;inset:-50%;z-index:9997;pointer-events:none;opacity:.045;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");animation:mxGrain 1s steps(6) infinite}
@keyframes mxGrain{0%{transform:translate(0,0)}20%{transform:translate(-4%,3%)}40%{transform:translate(3%,-5%)}60%{transform:translate(-6%,-2%)}80%{transform:translate(5%,4%)}100%{transform:translate(0,0)}}

/* Cursor */
.mx-cursor,.mx-ring{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;border-radius:50%;translate:-50% -50%}
.mx-cursor{width:6px;height:6px;background:var(--mx-glow);box-shadow:0 0 10px var(--mx-glow)}
.mx-ring{width:38px;height:38px;border:1px solid rgba(49,214,160,.65);transition:width .35s cubic-bezier(.2,.8,.2,1),height .35s cubic-bezier(.2,.8,.2,1),background .3s,border-color .3s;display:grid;place-items:center}
.mx-ring:before,.mx-ring:after{content:"";position:absolute;width:6px;height:1px;background:var(--mx-glow);left:-10px;top:50%}
.mx-ring:after{left:auto;right:-10px}
.mx-ring.is-hover{width:70px;height:70px;background:rgba(49,214,160,.10);border-color:var(--mx-glow)}
.mx-ring.is-down{width:26px;height:26px}
.mx-cursor-on,.mx-cursor-on a,.mx-cursor-on button{cursor:none!important}
.mx-cursor-on input,.mx-cursor-on textarea,.mx-cursor-on select{cursor:auto!important}

/* Scroll reveals (individual transform properties: never fight existing transforms) */
.mx-r{opacity:0;translate:0 46px;filter:blur(10px);transition:opacity .9s cubic-bezier(.2,.75,.2,1),translate 1.1s cubic-bezier(.16,1,.3,1),filter .9s ease,clip-path 1.2s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--mx-i,0)*75ms)}
.mx-r.mx-title{clip-path:inset(0 0 100% 0);translate:0 30px}
.mx-r.mx-media{clip-path:inset(12% 12% 12% 12% round 4px);scale:1.08;filter:blur(6px) saturate(.3);transition-property:opacity,translate,filter,clip-path,scale;transition-duration:.9s,1.2s,1.1s,1.3s,1.6s}
.mx-r.mx-in{opacity:1;translate:0 0;filter:none;clip-path:inset(-20% -20% -20% -20%)}
.mx-r.mx-media.mx-in{scale:1;clip-path:inset(0 0 0 0 round 0)}

/* Section scan line */
.mx-scan{position:fixed;left:0;right:0;top:0;height:120px;z-index:9996;pointer-events:none;opacity:0;background:linear-gradient(180deg,transparent,rgba(49,214,160,.10) 70%,rgba(49,214,160,.55) 99%,#b9f7df);mix-blend-mode:screen}
.mx-scan.go{animation:mxScan 1.15s cubic-bezier(.6,0,.3,1)}
@keyframes mxScan{0%{opacity:1;transform:translateY(-130px)}85%{opacity:.9}100%{opacity:0;transform:translateY(100vh)}}

/* Tilt + glare cards */
.mx-tilt{transform:perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateZ(0);transition:transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .5s;transform-style:preserve-3d;will-change:transform}
.mx-tilt.mx-hot{transition:transform .08s linear,box-shadow .3s;box-shadow:0 30px 60px -30px rgba(0,162,106,.55)}
.mx-glare{position:relative;isolation:isolate}
.mx-glare:before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:inherit;opacity:0;transition:opacity .4s;background:radial-gradient(420px circle at var(--gx,50%) var(--gy,50%),rgba(185,247,223,.22),transparent 45%);mix-blend-mode:screen}
.mx-glare.mx-hot:before{opacity:1}
.mx-glare:after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:inherit;padding:1px;opacity:0;transition:opacity .4s;background:radial-gradient(260px circle at var(--gx,50%) var(--gy,50%),var(--mx-glow),transparent 60%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.mx-glare.mx-hot:after{opacity:1}

/* Magnetic */
.mx-mag{transition:translate .5s cubic-bezier(.2,.8,.2,1)}
.mx-mag.mx-hot{transition:translate .12s linear}
.button.mx-mag{position:relative;overflow:hidden}
.button.mx-mag .mx-shine{position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);translate:-120% 0;transition:translate .8s cubic-bezier(.2,.8,.2,1)}

/* Hero title shimmer */
.hero-section h1.mx-shimmer{background:linear-gradient(100deg,#f8fbfa 0%,#f8fbfa 42%,#b9f7df 49%,#31d6a0 51%,#f8fbfa 58%,#f8fbfa 100%);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:mxShimmer 6s cubic-bezier(.6,0,.4,1) infinite}
@keyframes mxShimmer{0%{background-position:100% 0}55%,100%{background-position:0 0}}

/* Kinetic marquee */
.mx-marquee{position:relative;overflow:hidden;background:var(--mx-deep);border-block:1px solid rgba(49,214,160,.18);padding:22px 0;user-select:none;pointer-events:none}
.mx-marquee .mx-track{display:flex;width:max-content;gap:0;translate:var(--mq,0) 0;will-change:translate}
.mx-marquee span{font:700 clamp(38px,7vw,110px)/1 inherit;letter-spacing:-.03em;text-transform:uppercase;white-space:nowrap;padding-right:.6em;color:transparent;-webkit-text-stroke:1px rgba(49,214,160,.55)}
.mx-marquee span:nth-child(3n+2){color:#f8fbfa;-webkit-text-stroke:0}
.mx-marquee span:nth-child(3n){-webkit-text-stroke-color:rgba(227,137,62,.7)}
.mx-marquee:before,.mx-marquee:after{content:"";position:absolute;top:0;bottom:0;width:15%;z-index:1;background:linear-gradient(90deg,var(--mx-deep),transparent)}
.mx-marquee:after{right:0;transform:scaleX(-1)}
.mx-marquee:before{left:0}

/* Driver HUD inside the 3D journey */
.mx-hud{position:fixed;right:28px;bottom:28px;z-index:40;pointer-events:none;width:300px;color:#dff;font:500 11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;opacity:0;translate:0 20px;transition:opacity .6s,translate .6s cubic-bezier(.2,.8,.2,1)}
.mx-hud.on{opacity:1;translate:0 0}
.mx-hud-box{position:relative;padding:14px 16px 12px;background:linear-gradient(135deg,rgba(2,20,26,.72),rgba(2,9,13,.55));border:1px solid rgba(49,214,160,.28);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))}
.mx-hud-box:before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--mx-glow),transparent);animation:mxHudScan 3.2s linear infinite}
@keyframes mxHudScan{0%{top:0;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:100%;opacity:0}}
.mx-hud-top{display:flex;justify-content:space-between;color:rgba(185,247,223,.7);margin-bottom:10px}
.mx-hud-top i{font-style:normal;color:#ff5a4a;display:inline-flex;align-items:center;gap:6px}
.mx-hud-top i:before{content:"";width:6px;height:6px;border-radius:50%;background:#ff5a4a;box-shadow:0 0 8px #ff5a4a;animation:mxBlink 1.2s steps(2) infinite}
@keyframes mxBlink{50%{opacity:.15}}
.mx-hud-row{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:10px;align-items:end}
.mx-hud-row small{display:block;color:rgba(185,247,223,.55);font-size:9px;margin-bottom:3px}
.mx-hud-row b{font:600 26px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff;letter-spacing:0;text-shadow:0 0 14px rgba(49,214,160,.6)}
.mx-hud-row b em{font-style:normal;font-size:10px;color:var(--mx-glow);margin-left:3px}
.mx-hud-row .mx-v b{font-size:34px}
.mx-gauge{height:3px;background:rgba(255,255,255,.08);margin-top:10px;position:relative;overflow:hidden}
.mx-gauge i{position:absolute;inset:0;transform-origin:0 50%;transform:scaleX(var(--g,0));background:linear-gradient(90deg,var(--mx-green),var(--mx-glow),var(--mx-copper));box-shadow:0 0 10px var(--mx-glow)}
.mx-hud-map{margin-top:12px}
.mx-hud-map svg{display:block;width:100%;height:34px;overflow:visible}
.mx-hud-ends{display:flex;justify-content:space-between;color:rgba(185,247,223,.6);font-size:9px;margin-top:4px}

/* Whole-site rail: a mini train that advances with page scroll */
.mx-rail{position:fixed;left:24px;top:50%;height:min(62vh,560px);translate:0 -50%;width:34px;z-index:41;pointer-events:none;opacity:0;transition:opacity .6s}
.mx-rail.on{opacity:1}
.mx-rail .mx-line{position:absolute;left:16px;top:0;bottom:0;width:2px;background:repeating-linear-gradient(180deg,rgba(151,165,168,.45) 0 2px,transparent 2px 7px)}
.mx-rail .mx-line:before,.mx-rail .mx-line:after{content:"";position:absolute;top:0;bottom:0;width:1px;background:rgba(151,165,168,.5);left:-4px}
.mx-rail .mx-line:after{left:auto;right:-4px}
.mx-rail .mx-done{position:absolute;left:12px;top:0;width:10px;height:calc(var(--p,0)*100%);background:linear-gradient(180deg,transparent,rgba(49,214,160,.35));box-shadow:0 0 18px rgba(49,214,160,.35)}
.mx-rail .mx-train{position:absolute;left:5px;top:calc(var(--p,0)*100%);translate:0 -100%;width:24px;filter:drop-shadow(0 0 6px rgba(49,214,160,.8))}
.mx-rail .mx-train svg{display:block;width:24px;height:auto}
.mx-rail .mx-st{position:absolute;left:0;width:34px;text-align:center;font:600 8px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;color:rgba(151,165,168,.85);writing-mode:vertical-rl;transform:rotate(180deg)}
.mx-rail .mx-st.a{top:-74px}.mx-rail .mx-st.b{bottom:-78px}
.mx-rail .mx-dot{position:absolute;left:13px;width:8px;height:8px;border-radius:50%;border:1px solid rgba(151,165,168,.7);background:var(--mx-deep);translate:0 -50%;transition:background .3s,border-color .3s,box-shadow .3s}
.mx-rail .mx-dot.lit{background:var(--mx-glow);border-color:var(--mx-glow);box-shadow:0 0 10px var(--mx-glow)}
.mx-rail .mx-km{position:absolute;left:34px;top:calc(var(--p,0)*100%);translate:0 -50%;font:600 10px/1 ui-monospace,Menlo,monospace;color:var(--mx-glow);white-space:nowrap;text-shadow:0 0 8px rgba(49,214,160,.6)}

/* Entry curtain for inner pages */
.mx-curtain{position:fixed;inset:0;z-index:10001;pointer-events:none;display:grid;grid-template-columns:repeat(6,1fr)}
.mx-curtain i{background:var(--mx-deep);border-right:1px solid rgba(49,214,160,.15);transform-origin:50% 0;animation:mxCurtain .9s cubic-bezier(.75,0,.2,1) forwards;animation-delay:calc(var(--k)*60ms)}
.mx-curtain i:nth-child(odd){transform-origin:50% 100%}
@keyframes mxCurtain{to{transform:scaleY(0)}}

@media (max-width:850px){.mx-hud{display:none}.mx-rail{left:6px;width:24px}.mx-rail .mx-st,.mx-rail .mx-km{display:none}}
`;

/* ------------------------------------------------------------------ setup */
const style = document.createElement('style'); style.id = 'mx-style'; style.textContent = css; document.head.appendChild(style);
const enabled = !reduce;
const overlay = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); return d; };
const progressBar = overlay('mx-progress');
if (enabled) overlay('mx-grain');
const scan = enabled ? overlay('mx-scan') : null;

/* ---------------------------------------------- cursor */
let ring, dot;
if (enabled && finePointer) {
 dot = overlay('mx-cursor'); ring = overlay('mx-ring');
 document.documentElement.classList.add('mx-cursor-on');
 const c = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
 addEventListener('pointermove', e => { c.x = e.clientX; c.y = e.clientY; const hot = e.target.closest?.('a,button,summary,[role=button],.partner-card,.chapter-card'); ring.classList.toggle('is-hover', !!hot); }, { passive: true });
 addEventListener('pointerdown', () => ring.classList.add('is-down')); addEventListener('pointerup', () => ring.classList.remove('is-down'));
 document.addEventListener('pointerleave', () => { dot.style.opacity = ring.style.opacity = 0; });
 document.addEventListener('pointerenter', () => { dot.style.opacity = ring.style.opacity = 1; });
 (function loop() { c.rx += (c.x - c.rx) * .18; c.ry += (c.y - c.ry) * .18; dot.style.transform = `translate(${c.x}px,${c.y}px)`; ring.style.transform = `translate(${c.rx}px,${c.ry}px)`; requestAnimationFrame(loop); })();
}

/* ---------------------------------------------- HUD + site rail */
const trainSvg = '<svg viewBox="0 0 24 60" fill="none"><rect x="5" y="2" width="14" height="20" rx="3" fill="#1846c8" stroke="#31d6a0"/><rect x="7" y="4" width="10" height="5" rx="1" fill="#b9f7df"/><rect x="5" y="17" width="14" height="2" fill="#1fc8d8"/><circle cx="8" cy="1.5" r="1.2" fill="#fff3d0"/><circle cx="16" cy="1.5" r="1.2" fill="#fff3d0"/><rect x="5.5" y="24" width="13" height="15" rx="1" fill="#1846c8" stroke="#1fc8d8" stroke-width=".8"/><rect x="7" y="25.5" width="10" height="12" fill="#6b2c19"/><rect x="5.5" y="41" width="13" height="15" rx="1" fill="#1846c8" stroke="#1fc8d8" stroke-width=".8"/><rect x="7" y="42.5" width="10" height="12" fill="#6b2c19"/><circle cx="12" cy="58.5" r="1.3" fill="#ff5a4a"/></svg>';
const hud = overlay('mx-hud', `<div class="mx-hud-box"><div class="mx-hud-top"><span class="mx-route"></span><i class="mx-live"></i></div>
<div class="mx-hud-row"><div class="mx-v"><small class="l-speed"></small><b><span class="v-speed">0</span><em>KM/H</em></b></div><div><small class="l-dist"></small><b><span class="v-dist">0</span><em>KM</em></b></div><div><small class="l-cargo"></small><b><span class="v-cargo">0</span><em>KT</em></b></div></div>
<div class="mx-gauge"><i></i></div>
<div class="mx-hud-map"><svg viewBox="0 0 268 34"><path class="mx-path" d="M4 26 C 40 30, 60 6, 100 14 S 160 30, 196 16 S 248 6, 264 10" stroke="rgba(151,165,168,.45)" stroke-width="1.5" stroke-dasharray="3 4" fill="none"/><path class="mx-path-done" d="M4 26 C 40 30, 60 6, 100 14 S 160 30, 196 16 S 248 6, 264 10" stroke="#31d6a0" stroke-width="2" fill="none"/><circle class="mx-pos" r="4" fill="#fff" stroke="#31d6a0" stroke-width="2"/></svg>
<div class="mx-hud-ends"><span class="e-from"></span><span class="e-to"></span></div></div></div>`);
const rail = overlay('mx-rail', `<span class="mx-st a"></span><div class="mx-line"></div><div class="mx-done"></div><div class="mx-train">${trainSvg}</div><span class="mx-km"></span><span class="mx-st b"></span>`);
const pathDone = hud.querySelector('.mx-path-done'), pos = hud.querySelector('.mx-pos'), pathLen = pathDone.getTotalLength();
pathDone.style.strokeDasharray = pathLen; pathDone.style.filter = 'drop-shadow(0 0 4px #31d6a0)';
function labels() {
 const L = t();
 hud.querySelector('.mx-route').textContent = L.route; hud.querySelector('.mx-live').textContent = L.live;
 hud.querySelector('.l-speed').textContent = L.speed; hud.querySelector('.l-dist').textContent = L.dist; hud.querySelector('.l-cargo').textContent = L.cargo;
 hud.querySelector('.e-from').textContent = L.from; hud.querySelector('.e-to').textContent = L.to;
 rail.querySelector('.mx-st.a').textContent = L.from; rail.querySelector('.mx-st.b').textContent = L.to;
}
labels();
const ROUTE_KM = 600;
let lastY = scrollY, lastT = performance.now(), vel = 0, shownSpeed = 0;
let dots = [];
function buildDots() {
 rail.querySelectorAll('.mx-dot').forEach(d => d.remove()); dots = [];
 const secs = [...document.querySelectorAll('main > section, main > div > section, .final-cta, .site-footer')];
 const H = Math.max(1, document.documentElement.scrollHeight - innerHeight);
 secs.slice(0, 18).forEach(s => {
  const y = clamp((s.getBoundingClientRect().top + scrollY) / H, 0, 1);
  const d = document.createElement('span'); d.className = 'mx-dot'; d.style.top = y * 100 + '%'; d.dataset.y = y; rail.appendChild(d); dots.push(d);
 });
}
let lastSection = null;
function frame() {
 const now = performance.now(), dt = Math.max(1, now - lastT);
 const H = Math.max(1, document.documentElement.scrollHeight - innerHeight), p = clamp(scrollY / H, 0, 1);
 vel += ((scrollY - lastY) / dt - vel) * .12; lastY = scrollY; lastT = now;
 progressBar.style.setProperty('--p', p);
 // site rail
 rail.style.setProperty('--p', p);
 rail.querySelector('.mx-km').textContent = 'KM ' + String(Math.round(p * ROUTE_KM)).padStart(3, '0');
 dots.forEach(d => d.classList.toggle('lit', +d.dataset.y <= p + .002));
 // journey HUD — mirrors the 3D train progress
 const shell = document.querySelector('.world-shell');
 let jp = 0, inWorld = false;
 if (shell) { const r = shell.getBoundingClientRect(); jp = clamp(-r.top / Math.max(1, shell.offsetHeight - innerHeight), 0, 1); inWorld = r.top < innerHeight * .2 && r.bottom > innerHeight * .6 && jp > .002; }
 hud.classList.toggle('on', inWorld && !paused());
 rail.classList.toggle('on', !inWorld && innerWidth > 600 && scrollY > 200);
 if (inWorld) {
  const target = clamp(Math.abs(vel) * 95, 0, 160) * (jp < .999 ? 1 : 0);
  shownSpeed += (target - shownSpeed) * .08;
  hud.querySelector('.v-speed').textContent = Math.round(shownSpeed);
  hud.querySelector('.v-dist').textContent = Math.round(jp * ROUTE_KM);
  hud.querySelector('.v-cargo').textContent = (34 + jp * 0).toFixed(0);
  hud.querySelector('.mx-gauge').style.setProperty('--g', shownSpeed / 160);
  pathDone.style.strokeDashoffset = pathLen * (1 - jp);
  const pt = pathDone.getPointAtLength(pathLen * jp); pos.setAttribute('cx', pt.x); pos.setAttribute('cy', pt.y);
 }
 // section entry scan
 if (scan && !paused()) {
  const mid = innerHeight * .5; let cur = null;
  document.querySelectorAll('main section').forEach(s => { const r = s.getBoundingClientRect(); if (r.top < mid && r.bottom > mid) cur = s; });
  if (cur && cur !== lastSection) { if (lastSection) { scan.classList.remove('go'); void scan.offsetWidth; scan.classList.add('go'); } lastSection = cur; }
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------------------------------------------- reveals, tilt, magnetic, counters, marquee */
const pendingReveal = new Set();
const reveal = el => { el.classList.add('mx-in'); pendingReveal.delete(el); io.unobserve(el); };
const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) reveal(e.target); }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
// Fallback for fast jumps (anchor links, chapter nav) where observers can lag.
let sweepQueued = false;
addEventListener('scroll', () => { if (sweepQueued) return; sweepQueued = true; setTimeout(() => { sweepQueued = false; pendingReveal.forEach(el => { if (!el.isConnected) return pendingReveal.delete(el); const r = el.getBoundingClientRect(); if (r.top < innerHeight * .92 && r.bottom > 0) reveal(el); }); }, 160); }, { passive: true });
const SKIP = '.site-header,.hero-section,.world-shell,.journey-section,.mx-marquee,.mobile-menu,dialog,[role=dialog]';
function enhanceReveals(root) {
 if (!enabled || paused()) return;
 root.querySelectorAll('main section, .site-footer').forEach(sec => {
  if (sec.closest(SKIP)) return;
  let i = 0;
  sec.querySelectorAll('h2,h3,.eyebrow,p,article,figure,.button,.editorial-link,li,img,.institutional-logo,.partner-card,.programme-panel,.countdown').forEach(el => {
   if (el.dataset.mx || el.closest(SKIP) || el.parentElement.closest('[data-mx="r"]')) return;
   const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return;
   el.dataset.mx = 'r'; el.classList.add('mx-r');
   if (/H2|H3/.test(el.tagName)) el.classList.add('mx-title');
   if (el.tagName === 'IMG' || el.tagName === 'FIGURE') el.classList.add('mx-media');
   el.style.setProperty('--mx-i', i++ % 6);
   if (r.top < innerHeight && r.bottom > 0) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('mx-in')));
   else { io.observe(el); pendingReveal.add(el); }
  });
 });
}
function enhanceTilt(root) {
 if (!enabled || !finePointer) return;
 root.querySelectorAll('.stats-grid article,.sponsor-benefit-grid > *,.project-track figure,.institutional-logo,.audience-detail,.sector-detail,.programme-panel,.chapter-card-inner,.news-empty').forEach(el => {
  if (el.dataset.mxt) return; el.dataset.mxt = '1';
  const cs = getComputedStyle(el);
  const canTilt = cs.transform === 'none' && !el.closest('.journey-section');
  const canGlare = getComputedStyle(el, '::before').content === 'none' && getComputedStyle(el, '::after').content === 'none';
  if (canTilt) el.classList.add('mx-tilt'); if (canGlare) el.classList.add('mx-glare');
  if (!canTilt && !canGlare) return;
  el.addEventListener('pointermove', e => {
   if (paused()) return;
   const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
   el.classList.add('mx-hot'); el.style.setProperty('--gx', x * 100 + '%'); el.style.setProperty('--gy', y * 100 + '%');
   if (canTilt) { el.style.setProperty('--ry', (x - .5) * 10 + 'deg'); el.style.setProperty('--rx', (.5 - y) * 8 + 'deg'); }
  });
  el.addEventListener('pointerleave', () => { el.classList.remove('mx-hot'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
 });
}
function enhanceMagnetic(root) {
 if (!enabled || !finePointer) return;
 root.querySelectorAll('.button,.hero-explore,.editorial-link').forEach(el => {
  if (el.dataset.mxm) return; el.dataset.mxm = '1'; el.classList.add('mx-mag');
  let shine = null;
  if (el.classList.contains('button')) { shine = document.createElement('span'); shine.className = 'mx-shine'; shine.setAttribute('aria-hidden', 'true'); el.appendChild(shine); }
  el.addEventListener('pointermove', e => { if (paused()) return; const r = el.getBoundingClientRect(); el.classList.add('mx-hot'); el.style.translate = `${(e.clientX - r.left - r.width / 2) * .25}px ${(e.clientY - r.top - r.height / 2) * .35}px`; });
  el.addEventListener('pointerenter', () => { if (shine) shine.style.translate = '120% 0'; });
  el.addEventListener('pointerleave', () => { el.classList.remove('mx-hot'); el.style.translate = '0 0'; if (shine) { shine.style.transition = 'none'; shine.style.translate = '-120% 0'; void shine.offsetWidth; shine.style.transition = ''; } });
 });
}
// Text decode on eyebrows (single text-node only).
const GLYPHS = '01#/\\<>_=+*ΣΔ∞';
const decodeIO = new IntersectionObserver(entries => entries.forEach(e => {
 if (!e.isIntersecting) return; decodeIO.unobserve(e.target);
 const node = e.target.childNodes.length === 1 && e.target.firstChild.nodeType === 3 ? e.target.firstChild : null; if (!node) return;
 const final = node.nodeValue, t0 = performance.now(), dur = 900;
 (function step(now) { const k = clamp((now - t0) / dur, 0, 1), n = Math.floor(final.length * k); node.nodeValue = k < 1 ? final.slice(0, n) + [...final.slice(n)].map(c => c === ' ' ? ' ' : GLYPHS[Math.random() * GLYPHS.length | 0]).join('') : final; if (k < 1) requestAnimationFrame(step); })(t0);
}), { threshold: .6 });
function enhanceDecode(root) {
 if (!enabled) return;
 root.querySelectorAll('.eyebrow,.hero-official,.hero-event-name').forEach(el => { if (el.dataset.mxd) return; el.dataset.mxd = '1'; decodeIO.observe(el); });
}
function enhanceHero() {
 const h1 = document.querySelector('.hero-section h1');
 if (enabled && h1 && !h1.classList.contains('mx-shimmer')) h1.classList.add('mx-shimmer');
}
// Kinetic marquee bands, kept outside React-owned lists by anchoring before known sections.
const MARQ = { fr: ['Simandou', 'Conakry 2026', 'Mines', 'Rail', 'Port', 'Diversification', 'Investissement', 'Guinée'], en: ['Simandou', 'Conakry 2026', 'Mining', 'Rail', 'Port', 'Diversification', 'Investment', 'Guinea'], zh: ['西芒杜', '科纳克里 2026', '矿业', '铁路', '港口', '多元化', '投资', '几内亚'] };
const marquees = [];
function enhanceMarquee() {
 if (!enabled) return;
 for (let i = marquees.length - 1; i >= 0; i--) { const m = marquees[i]; if (!m.anchor.isConnected || m.el.nextElementSibling !== m.anchor) { m.el.remove(); marquees.splice(i, 1); } }
 ['.stats-section', '.final-cta'].forEach((sel, k) => {
  const anchor = document.querySelector('main ' + sel) || document.querySelector(sel);
  if (!anchor || marquees.some(m => m.anchor === anchor)) return;
  const words = MARQ[lang()] || MARQ.fr, el = document.createElement('div');
  el.className = 'mx-marquee'; el.setAttribute('aria-hidden', 'true'); el.dataset.dir = k ? -1 : 1;
  el.innerHTML = `<div class="mx-track">${[...words, ...words, ...words].map(w => `<span>${w}</span>`).join('')}</div>`;
  anchor.parentNode.insertBefore(el, anchor); marquees.push({ el, anchor, x: 0 });
 });
}
let mqLastY = scrollY;
(function mqLoop() {
 const dy = scrollY - mqLastY; mqLastY = scrollY;
 marquees.forEach(m => { const tr = m.el.firstChild, w = tr.scrollWidth / 3 || 1; m.x -= (.6 + Math.abs(dy) * .35) * +m.el.dataset.dir; m.x = ((m.x % w) + w) % w; tr.style.setProperty('--mq', -m.x + 'px'); });
 requestAnimationFrame(mqLoop);
})();

// Parallax on editorial imagery.
function parallax() {
 if (enabled && !paused()) document.querySelectorAll('.vision-collage img,.project-track figure img,.final-cta-bg').forEach(el => {
  const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; el.style.translate = `0 ${(-k * 40).toFixed(1)}px`;
 });
 requestAnimationFrame(parallax);
}
requestAnimationFrame(parallax);

// Curtain on inner pages.
if (enabled && !paused() && !/^\/simandou-mining-summit-2026\/(fr|en|zh)\/?$/.test(location.pathname)) {
 const c = overlay('mx-curtain', Array.from({ length: 6 }, (_, k) => `<i style="--k:${k}"></i>`).join(''));
 setTimeout(() => c.remove(), 1400);
}

let pending = false;
function enhanceAll() {
 pending = false;
 if (!document.querySelector('#root main')) return;
 labels(); enhanceHero(); enhanceMarquee(); enhanceReveals(document); enhanceTilt(document); enhanceMagnetic(document); enhanceDecode(document);
 buildDots();
}
new MutationObserver(() => { if (!pending) { pending = true; setTimeout(enhanceAll, 120); } }).observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
addEventListener('resize', () => setTimeout(buildDots, 200));
addEventListener('load', () => setTimeout(enhanceAll, 300));
enhanceAll();
