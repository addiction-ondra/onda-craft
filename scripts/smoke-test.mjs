// Smoke test ONDA CRAFT v Chromiu (Playwright).
// Spouští produkční náhled (`vite preview`), hraje základní mechaniky a ukládá screenshoty do test-results/.
// Použití: npm run build && npm run test:e2e
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const OUT = 'test-results';
mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.log(`  ✗ ${msg}`);
  }
};

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* čekáme */
  }
  await sleep(200);
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

// --- helpery běžící ve stránce -----------------------------------------------
const snap = (page) => page.evaluate(() => window.__onda.controller.getSnapshot());
const blockAt = (page, p) => page.evaluate((p) => window.__onda.world().get(p) ?? null, p);
const screenOf = (page, p, face = 'top') => page.evaluate(([p, face]) => window.__onda.view.projectToScreen(p, face), [p, face]);
const pickAt = (page, pt) =>
  page.evaluate(([x, y]) => {
    const r = window.__onda.view.pick(x, y);
    return r && r.kind === 'block' ? { pos: r.pos, block: r.block } : r ? { kind: r.kind } : null;
  }, [pt.x, pt.y]);

const settle = (page) => page.waitForFunction(() => window.__onda.view.isSettled(), null, { timeout: 10000 });

async function tapCell(page, p, face = 'top', touch = false) {
  await settle(page);
  const pt = await screenOf(page, p, face);
  if (touch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
  await sleep(60);
}

/** Otáčí světem, dokud není cílová kostka vidět, pak na ni ťukne (jako dítě). */
async function tapVisible(page, p, face = 'top') {
  for (let rot = 0; rot < 4; rot++) {
    await settle(page);
    const hit = await pickAt(page, await screenOf(page, p, face));
    if (hit?.pos && hit.pos.x === p.x && hit.pos.y === p.y && hit.pos.z === p.z) {
      await tapCell(page, p, face);
      return true;
    }
    await page.getByRole('button', { name: 'Otočit doprava' }).click();
    await sleep(700);
  }
  return false;
}

// ============================================================================
async function ipadFlow() {
  console.log('\niPad (landscape):');
  const ctx = await browser.newContext({ ...devices['iPad (gen 7) landscape'], serviceWorkers: 'allow', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${BASE}/?test`);
  await page.waitForFunction(() => !!window.__onda);
  await sleep(400);
  await page.screenshot({ path: `${OUT}/01-start.png` });

  await page.getByRole('button', { name: 'Hrát' }).click();
  await sleep(500);
  ok((await snap(page)).started, 'hra se spustí tlačítkem Hrát');
  ok((await page.evaluate(() => window.__onda.controller.sfx.ctx?.state)) === 'running', 'zvuk (Web Audio) se po ťuknutí na Hrát zapne');
  await page.screenshot({ path: `${OUT}/02-world.png` });

  // --- výběr materiálu a pokládání
  await page.getByRole('button', { name: 'kámen', exact: true }).click();
  ok((await snap(page)).material === 'stone', 'výběr materiálu (kámen)');
  const g = { x: 5, y: 0, z: 4 };
  ok((await pickAt(page, await screenOf(page, g)))?.pos?.x === 5, 'raycast trefí správné pole');
  await tapCell(page, g, 'top', true);
  ok((await blockAt(page, { x: 5, y: 1, z: 4 })) === 'stone', 'ťuknutí položí kostku na trávu');
  await tapCell(page, { x: 5, y: 1, z: 4 });
  ok((await blockAt(page, { x: 5, y: 2, z: 4 })) === 'stone', 'kostku lze položit na kostku (stavění do výšky)');

  // --- guma
  await page.getByRole('button', { name: 'Guma' }).click();
  ok(await tapVisible(page, { x: 5, y: 2, z: 4 }), 'kostka je po otočení vidět');
  ok((await blockAt(page, { x: 5, y: 2, z: 4 })) === null, 'guma odstraní kostku');
  await tapCell(page, { x: 3, y: 0, z: 5 });
  ok((await blockAt(page, { x: 3, y: 0, z: 5 })) === 'grass', 'terén gumou odstranit nejde');
  await page.getByRole('button', { name: 'Stavět' }).click();

  // --- otáčení kamery
  const before = await screenOf(page, { x: 0, y: 0, z: 0 });
  await page.getByRole('button', { name: 'Otočit doprava' }).click();
  await settle(page);
  const after = await screenOf(page, { x: 0, y: 0, z: 0 });
  ok(Math.hypot(before.x - after.x, before.y - after.y) > 50, 'tlačítko otočí svět');
  await page.getByRole('button', { name: 'Otočit doleva' }).click();
  await sleep(700);

  // --- MISE 1: 5 dřevěných kostek
  await page.getByRole('button', { name: 'Úkoly' }).click();
  await page.getByRole('button', { name: '5 dřevěných kostek' }).click();
  ok((await snap(page)).overlay?.kind === 'intro', 'mise 1: úvodní karta s ukázkou');
  await page.screenshot({ path: `${OUT}/03-intro-wood.png` });
  await page.getByRole('button', { name: 'Jdeme na to!' }).click();
  ok((await snap(page)).highlightMaterial === 'wood', 'mise 1: nápověda zvýrazní dřevo (byl vybrán kámen)');
  // jiný materiál = jemná nápověda, ne trest
  await tapCell(page, { x: 1, y: 0, z: 9 });
  ok((await snap(page)).mission?.progress === 0, 'mise 1: jiný materiál se nepočítá, ale nic se nestane');
  await page.getByRole('button', { name: 'dřevo' }).click();
  for (let i = 0; i < 5; i++) {
    await tapCell(page, { x: 4 + i, y: 0, z: 5 });
    if (i === 2) await page.screenshot({ path: `${OUT}/04-mission-wood-progress.png` });
  }
  ok((await snap(page)).mission?.progress === 5 || (await snap(page)).completed.includes('wood5'), 'mise 1: počítá položené dřevo');
  await sleep(1300);
  let s = await snap(page);
  ok(s.overlay?.kind === 'success' && s.completed.includes('wood5'), 'mise 1: oslava a hvězdička');
  await page.screenshot({ path: `${OUT}/05-success.png` });

  // --- MISE 2: najdi 3 červené kostky (přes tlačítko „Další úkol“)
  await page.getByRole('button', { name: 'Další úkol' }).click();
  ok((await snap(page)).overlay?.mission === 'findRed', 'mise 2: nabídnuta jako další úkol');
  await page.getByRole('button', { name: 'Jdeme na to!' }).click();
  const targets = await page.evaluate(() => window.__onda.controller.mission.targets);
  ok(targets.length === 3, 'mise 2: ve světě se schovaly 3 červené kostky');
  await page.getByRole('button', { name: 'Nápověda' }).click();
  await sleep(300);
  await page.screenshot({ path: `${OUT}/06-mission-red-hint.png` });
  for (const t of targets) await tapVisible(page, t);
  await sleep(1300);
  s = await snap(page);
  ok(s.completed.includes('findRed'), 'mise 2: všechny červené kostky nalezeny');
  await page.getByRole('button', { name: 'Další úkol' }).click();

  // --- MISE 3: most přes řeku
  await page.getByRole('button', { name: 'Jdeme na to!' }).click();
  ok((await snap(page)).mission?.id === 'bridge', 'mise 3: spuštěna');
  await sleep(200);
  await page.screenshot({ path: `${OUT}/07-mission-bridge-ghosts.png` });
  // Zvířátka chodí po břehu a mohou vodu zakrýt – zkusíme víc sloupců řeky.
  let bx = -1;
  for (const x of [5, 6, 4, 3, 10, 12, 13, 2]) {
    if (await tapVisible(page, { x, y: 0, z: 7 }, 'center')) {
      bx = x;
      break;
    }
  }
  ok((await snap(page)).mission?.progress === 1, 'mise 3: první kostka na vodě = pokrok');
  await tapVisible(page, { x: bx, y: 0, z: 8 }, 'center');
  await sleep(1300);
  s = await snap(page);
  ok(s.completed.includes('bridge') && s.overlay?.kind === 'success', 'mise 3: most hotový');
  await page.screenshot({ path: `${OUT}/08-bridge-done.png` });
  ok(!(await page.getByRole('button', { name: 'Další úkol' }).count()), 'po všech misích už „Další úkol“ není');
  await page.getByRole('button', { name: 'Stavět dál' }).click();

  // --- zvířátko
  const dog = await page.evaluate(() => {
    const a = window.__onda.view.animals[0];
    const p = a.group.position;
    return window.__onda.view.projectToScreen({ x: p.x - 0.5, y: p.y - 0.6, z: p.z - 0.5 }, 'top');
  });
  const animalHit = await page.evaluate(([x, y]) => window.__onda.view.pick(x, y)?.kind, [dog.x, dog.y]);
  ok(animalHit === 'animal', 'ťuknutí na pejska trefí zvířátko');

  // --- automatické ukládání + obnova po reloadu
  await sleep(600);
  await page.reload();
  await page.waitForFunction(() => !!window.__onda);
  ok((await blockAt(page, { x: bx, y: 1, z: 7 })) === 'wood', 'svět se po obnovení stránky načte (most zůstal)');
  ok((await snap(page)).completed.length === 3, 'hvězdičky misí zůstaly uložené');
  await page.getByRole('button', { name: 'Hrát' }).click();
  await page.screenshot({ path: `${OUT}/09-after-reload.png` });

  // --- rodičovská zóna
  await page.getByRole('button', { name: 'Pro rodiče' }).click();
  const q = await page.locator('.gate h2').textContent();
  const [a, b] = q.match(/\d+/g).map(Number);
  await page.screenshot({ path: `${OUT}/10-parent-gate.png` });
  for (const d of String(a + b)) await page.locator('.keypad button', { hasText: new RegExp(`^${d}$`) }).click();
  ok(await page.getByText('Rodičovské nastavení').isVisible(), 'rodičovská brána se otevře správným výsledkem');
  await page.getByRole('switch').first().click();
  await sleep(600);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ondacraft:save')));
  ok(saved.settings.voice === false, 'vypnutí hlasu se uloží');
  await page.screenshot({ path: `${OUT}/11-parent-settings.png` });
  await page.getByRole('button', { name: 'Nový svět' }).click();
  await page.getByRole('button', { name: 'Ano' }).click();
  ok((await blockAt(page, { x: bx, y: 1, z: 7 })) === null, 'reset světa (s potvrzením) funguje');
  await page.getByRole('button', { name: 'Zavřít' }).click();

  // --- PWA / offline
  const swReady = await page.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
    return !!reg?.active;
  });
  ok(swReady, 'service worker je aktivní');
  await sleep(1500);
  await ctx.setOffline(true);
  await page.reload();
  const offlineOk = await page
    .waitForFunction(() => !!window.__onda, null, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  ok(offlineOk, 'hra se načte i offline');
  await ctx.setOffline(false);

  ok(errors.length === 0, `bez chyb v konzoli${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

async function iphoneFlow() {
  console.log('\niPhone (portrait):');
  const ctx = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?test`);
  await page.waitForFunction(() => !!window.__onda);
  await page.screenshot({ path: `${OUT}/20-iphone-start.png` });
  await page.getByRole('button', { name: 'Hrát' }).tap();
  await sleep(500);
  await page.getByRole('button', { name: 'modrá' }).tap();
  await tapCell(page, { x: 6, y: 0, z: 5 }, 'top', true);
  ok((await blockAt(page, { x: 6, y: 1, z: 5 })) === 'blue', 'dotyk na telefonu položí kostku');
  // všechny ovládací prvky jsou vidět a mají velikost pro dětský prst
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('.swatch, .big-btn')].map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, inView: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.top >= 0 };
    }),
  );
  ok(sizes.every((s) => s.inView), 'všechna tlačítka jsou na obrazovce');
  ok(sizes.every((s) => Math.min(s.w, s.h) >= 48), `tlačítka ≥ 48 px (min ${Math.round(Math.min(...sizes.map((s) => Math.min(s.w, s.h))))} px)`);
  await page.screenshot({ path: `${OUT}/21-iphone-world.png` });
  await page.getByRole('button', { name: 'Úkoly' }).tap();
  await page.getByRole('button', { name: 'Most přes řeku' }).tap();
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/22-iphone-intro.png` });
  ok(errors.length === 0, `bez chyb v konzoli${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

try {
  await ipadFlow();
  await iphoneFlow();
} catch (e) {
  failures++;
  console.error(e);
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} kontrol(a) selhalo` : '\nVšechny kontroly prošly ✔');
process.exit(failures ? 1 : 0);
