const { boot } = require('./e2e-lib');
(async () => {
  const { b, p, log, text, shot, wait, mock, doLogin } = await boot({ login: false });
  await shot('20-login');
  await doLogin('mala');
  console.log('WRONG PW:', (await text()).match(/Email o contraseña incorrectos/) ? 'OK error shown' : 'FAIL ' + (await text()).slice(0, 300));
  await doLogin();
  await shot('21-home-empty');
  console.log('HOME:', (await text()).slice(0, 300));
  console.log('\nCALLS:', mock.calls.slice(0, 12).join('\n'));
  console.log('\nLOG:', log.join('\n'));
  await b.close();
})();
