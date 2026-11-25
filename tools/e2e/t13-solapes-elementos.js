// Detector de elementos que se pisan: en cada pantalla, tamaño y tema busca textos, botones o campos visibles
// cuyas cajas se solapan (y no son uno parte del otro), y elementos que se salen por los lados de la ventana.
// Las barras flotantes (navegación inferior de vidrio, barra de título al desplazarse) se excluyen: tapan el
// contenido a propósito mientras se desplaza.
// Uso: PORT=8780 node e2e/t13-solapes-elementos.js   ·   BASE=https://… node e2e/t13-solapes-elementos.js   ·   BIG=1 (300 pedidos)
const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
const { seed } = require('./seed');
const { seedBig } = require('./seedbig');

const base = process.env.BASE || `http://localhost:${process.env.PORT || 8780}`;
const big = process.env.BIG === '1';
const SIZES = [[320, 640, 'xs'], [390, 844, 'móvil'], [844, 390, 'horizontal'], [768, 1024, 'tablet'], [1024, 768, 'portátil'], [1440, 900, 'ordenador'], [2000, 1000, 'ancho']];
const PAGES = [
  ['inicio', '/'],
  ['ficha', '/order-detail?orderId=' + (big ? 'b0' : 'o1')],
  ['formulario', '/order-form?editOrderId=' + (big ? 'b0' : 'o1')],
  ['nuevo', '/order-form'],
  ['referencias', '/manufacturers'],
  ['fabricantes', '/suppliers'],
  ['ajustes', '/settings'],
];

/** Se ejecuta en la página: devuelve los pares que se pisan y lo que se sale de la ventana */
function audit() {
  const vis = el => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      if (s.position === 'fixed' || (s.position === 'absolute' && /bar|nav/i.test(p.getAttribute('data-testid') || ''))) return 'flotante';
    }
    return true;
  };
  const floatingRoots = new Set();
  // contenedores flotantes reconocibles: navegación y barras de vidrio en posición absoluta/fija pegadas arriba o abajo
  document.querySelectorAll('[role="navigation"], [role="tablist"]').forEach(n => floatingRoots.add(n));
  const inFloating = el => {
    for (let p = el; p; p = p.parentElement) {
      if (floatingRoots.has(p)) return true;
      const s = getComputedStyle(p);
      if ((s.position === 'absolute' || s.position === 'fixed') && p.getBoundingClientRect().height < 140 && (p.getBoundingClientRect().top <= 0 || p.getBoundingClientRect().bottom >= innerHeight - 1)) return true;
    }
    return false;
  };
  // escenas inactivas de la navegación (pantallas anteriores que siguen montadas): se ignoran
  const inactiveScene = el => {
    for (let p = el; p; p = p.parentElement) {
      if (p.getAttribute('aria-hidden') === 'true') return true;
      const s = getComputedStyle(p);
      if (s.pointerEvents === 'none' && s.position === 'absolute' && p.getBoundingClientRect().width >= innerWidth * 0.5) return true;
    }
    return false;
  };
  const items = [];
  // Caja realmente visible: recortada por los contenedores con desplazamiento u overflow oculto
  const visibleRect = el => {
    const b = el.getBoundingClientRect();
    let l = b.left, t = b.top, r = b.right, bo = b.bottom;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(s.overflow + s.overflowX + s.overflowY)) {
        const c = p.getBoundingClientRect();
        l = Math.max(l, c.left); t = Math.max(t, c.top); r = Math.min(r, c.right); bo = Math.min(bo, c.bottom);
      }
    }
    return { left: l, top: t, right: r, bottom: bo, width: Math.max(0, r - l), height: Math.max(0, bo - t), raw: b };
  };
  const push = (el, kind) => {
    const r = visibleRect(el);
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight) return;
    if (!vis(el) || inFloating(el) || inactiveScene(el)) return;
    // la escena activa es la que está encima en el centro de la caja
    const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
    if (top && !(top === el || el.contains(top) || top.contains(el))) {
      // tapado por algo: si lo que tapa es opaco y no es parte de una barra flotante, lo marcamos luego como solape
      if (inFloating(top)) return;
    }
    const label = (el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    items.push({ el, r, kind, label });
  };
  // hojas de texto (elementos cuyo texto propio no es vacío) y controles
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textEls = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent.trim();
    if (t && walker.currentNode.parentElement) textEls.add(walker.currentNode.parentElement);
  }
  textEls.forEach(el => push(el, 'texto'));
  document.querySelectorAll('input, textarea, [role="button"], button').forEach(el => push(el, 'control'));

  const overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // dos trozos en línea del mismo párrafo (p. ej. «3 pedidos requieren atención» y «· 1 con retraso»): sus cajas se cruzan al partirse en líneas
      if (getComputedStyle(a.el).display === 'inline' && getComputedStyle(b.el).display === 'inline' && a.el.parentElement === b.el.parentElement) continue;
      const x = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
      const y = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
      const inter = x * y;
      if (inter < 30) continue;
      const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      if (inter / small < 0.25) continue;
      // un texto dentro de un control (etiqueta del botón) no cuenta
      if ((a.kind === 'control' && a.el.contains(b.el)) || (b.kind === 'control' && b.el.contains(a.el))) continue;
      overlaps.push(`«${a.label}» × «${b.label}» (${Math.round((inter / small) * 100)} %)`);
    }
  }
  // se sale de la ventana o de su tarjeta (lo visible queda recortado respecto a su tamaño real, sin ser una lista con desplazamiento lateral)
  const inHScroller = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  const outside = items
    .filter(it => !inHScroller(it.el) && (it.r.raw.right > innerWidth + 1 || it.r.raw.left < -1 || (it.r.raw.width - it.r.width > 4 && it.r.raw.top >= it.r.top - 1 && it.r.raw.bottom <= it.r.bottom + 1)))
    .map(it => `«${it.label}» se sale o queda recortado por ${it.r.raw.left < -1 ? 'la izquierda' : 'la derecha'} (${Math.round(it.r.raw.left)}–${Math.round(it.r.raw.right)}, visible hasta ${Math.round(it.r.right)}, ventana ${innerWidth})`);
  // textos cortados en vertical por su contenedor (texto con overflow oculto y más alto que su caja)
  return { overlaps: [...new Set(overlaps)].slice(0, 12), outside: [...new Set(outside)].slice(0, 8), hscroll: document.documentElement.scrollWidth > innerWidth + 1, n: items.length };
}

(async () => {
  const b = await chromium.launch();
  let problems = 0;
  for (const dark of [false, true]) {
    for (const [w, h, tag] of SIZES) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      if (dark) await ctx.addInitScript(() => localStorage.setItem('@ao_theme_mode', 'dark'));
      const mock = createMock();
      (big ? seedBig : seed)(mock.db);
      await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
      await ctx.route('wss://**', r => r.abort());
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(base + '/?r=' + Date.now(), { waitUntil: 'networkidle' });
      await p.waitForTimeout(1200);
      // la entrada también se audita
      const pages = [['entrada', null], ...PAGES];
      for (const [name, url] of pages) {
        if (name === 'inicio') {
          await p.getByTestId('login-username').fill('dvdtrebol3@gmail.com');
          await p.getByTestId('login-password').fill(PASSWORD);
          await p.getByTestId('login-submit').click();
          await p.waitForTimeout(2500);
        } else if (url) {
          await p.goto(base + url, { waitUntil: 'networkidle' });
          await p.waitForTimeout(1800);
        }
        // arriba y tras desplazarse
        for (const pos of ['arriba', 'abajo']) {
          if (pos === 'abajo') {
            await p.mouse.move(w / 2, h / 2);
            await p.mouse.wheel(0, Math.round(h * 0.9));
            await p.waitForTimeout(600);
          }
          const r = await p.evaluate(audit);
          const bad = r.overlaps.length + r.outside.length + (r.hscroll ? 1 : 0);
          if (bad) {
            problems += bad;
            console.log(`FAIL [${dark ? 'oscuro' : 'claro'} · ${tag} ${w}×${h}] ${name} (${pos})`);
            r.overlaps.forEach(o => console.log('     solape: ' + o));
            r.outside.forEach(o => console.log('     fuera:  ' + o));
            if (r.hscroll) console.log('     la página tiene desplazamiento horizontal');
          }
        }
      }
      if (errs.length) {
        problems += errs.length;
        console.log(`FAIL [${dark ? 'oscuro' : 'claro'} · ${tag}] errores de página: ${errs.join(' | ')}`);
      }
      await ctx.close();
    }
  }
  console.log(problems ? `\n${problems} problemas` : '\nOK   sin solapes, sin elementos fuera de la pantalla y sin errores en ninguna pantalla, tamaño ni tema');
  await b.close();
})();
