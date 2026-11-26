const { chromium } = require('playwright');
const { createMock, PASSWORD } = require('./mock');
exports.boot = async ({ login = true, viewport = { width: 390, height: 844 } } = {}) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport });
  const mock = createMock();
  await ctx.route('https://ixsosbtieclihoizmszq.supabase.co/**', mock.handler);
  await ctx.route('wss://**', r => r.abort());
  const p = await ctx.newPage();
  const log = [];
  p.on('pageerror', e => log.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/WebSocket|realtime|ERR_FAILED/i.test(m.text())) log.push('ERR ' + m.text().slice(0, 300)); });
  const text = async () => (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
  const shot = async (n, full) => { await p.waitForTimeout(700); await p.screenshot({ path: `${require("path").join(__dirname, "../out")}/${n}.png`, fullPage: !!full }); };
  const wait = ms => p.waitForTimeout(ms);
  await p.goto('http://localhost:' + (process.env.PORT || '8766') + '/', { waitUntil: 'networkidle' }); await wait(1500);
  const doLogin = async (pw = PASSWORD) => {
    await p.getByTestId('login-username').fill('admin@ao-gestiones.test');
    await p.getByTestId('login-password').fill(pw);
    await p.getByTestId('login-submit').click(); await wait(2000);
  };
  if (login) await doLogin();
  return { b, p, log, text, shot, wait, mock, doLogin };
};
