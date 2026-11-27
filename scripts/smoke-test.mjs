// Smoke test Ondra a Laura Craft v Chromiu (Playwright).
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

const settle = (page) => page.waitForFunction(() => window.__onda.view.isSettled(), null, { timeout: 30000 });

async function tapCell(page, p, face = 'top', touch = false) {
  await settle(page);
  const pt = await screenOf(page, p, face);
  if (touch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
  await sleep(60);
}

/** Otáčí světem, dokud není cílová kostka vidět, pak na ni ťukne (jako dítě). */
async function tapVisible(page, p, face = 'top') {
  const seen = [];
  for (let rot = 0; rot < 8; rot++) {
    await settle(page);
    const hit = await pickAt(page, await screenOf(page, p, face));
    if (hit?.pos && hit.pos.x === p.x && hit.pos.y === p.y && hit.pos.z === p.z && (await onCanvas(page, await screenOf(page, p, face)))) {
      await tapCell(page, p, face);
      return true;
    }
    seen.push(hit?.pos ? `${hit.block}@${hit.pos.x},${hit.pos.y},${hit.pos.z}` : hit?.kind ?? 'nic');
    await page.getByRole('button', { name: 'Otočit doprava' }).click();
  }
  console.log(`    (cíl ${JSON.stringify(p)} zakryt: ${seen.join(', ')})`);
  return false;
}

/** Je bod na herní ploše (ne pod tlačítkem nahoře/dole)? */
const onCanvas = (page, pt) => page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.classList.contains('game-canvas') ?? false, [pt.x, pt.y]);

/** Otáčí světem, dokud ťuknutí nepadne na svítící místo `p`, pak ťukne (kostka se položí přímo tam). */
async function tapGhost(page, p) {
  const seen = [];
  for (let rot = 0; rot < 8; rot++) {
    await settle(page);
    const r = await page.evaluate((p) => {
      const v = window.__onda.view;
      const s = v.projectToScreen(p, 'center');
      const hit = v.pick(s.x, s.y);
      const what = hit?.kind === 'block' ? `${hit.block}@${hit.pos.x},${hit.pos.y},${hit.pos.z}` : hit?.kind === 'animal' ? hit.animal.kind : hit?.kind === 'ghost' ? `ghost@${hit.pos.x},${hit.pos.y},${hit.pos.z}` : 'nic';
      return { s, what, ok: hit?.kind === 'ghost' && hit.pos.x === p.x && hit.pos.y === p.y && hit.pos.z === p.z };
    }, p);
    if (r.ok && (await onCanvas(page, r.s))) {
      await page.mouse.click(r.s.x, r.s.y);
      await sleep(80);
      return true;
    }
    seen.push(r.what);
    await page.getByRole('button', { name: 'Otočit doprava' }).click();
  }
  console.log(`    (svítící místo ${JSON.stringify(p)} zakryto: ${seen.join(', ')})`);
  return false;
}

/** Otáčí světem, dokud není tvor vidět, pak na něj ťukne. Vrací, co ťuknutí trefilo. */
async function tapCreature(page, which) {
  for (let rot = 0; rot < 8; rot++) {
    await settle(page);
    const r = await page.evaluate((which) => {
      const c = window.__onda.controller;
      const a = c.characters.get(which) ?? c.animals.get(which);
      const g = a.group.position;
      const s = window.__onda.view.projectToScreen({ x: g.x - 0.5, y: g.y - 0.6, z: g.z - 0.5 }, 'top');
      const hit = window.__onda.view.pick(s.x, s.y);
      return { s, kind: hit?.kind === 'animal' ? hit.animal.kind : null };
    }, which);
    const vp = page.viewportSize();
    const onScreen = r.s.x > 0 && r.s.y > 0 && r.s.x < vp.width && r.s.y < vp.height;
    if (r.kind === which && onScreen && (await onCanvas(page, r.s))) {
      await page.mouse.click(r.s.x, r.s.y);
      return true;
    }
    await page.getByRole('button', { name: 'Otočit doprava' }).click();
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
  let s0;
  ok((await page.evaluate(() => window.__onda.controller.sfx.ctx?.state)) === 'running', 'zvuk (Web Audio) se po ťuknutí na Hrát zapne');
  await page.screenshot({ path: `${OUT}/02-world.png` });

  // --- výběr materiálu a pokládání
  s0 = await snap(page);
  ok(s0.playMode === 'walk' && (await page.getByRole('button', { name: 'Ondra' }).isVisible()), 'výchozí režim je panáček: dole se vybírá kamarád');
  const sizeBefore = await page.evaluate(() => window.__onda.world().size);
  await tapCell(page, { x: 3, y: 0, z: 4 });
  ok((await page.evaluate(() => window.__onda.world().size)) === sizeBefore && (await snap(page)).nudgeCharacters, 'v režimu chození ťuknutí nic nepostaví, jen poradí vybrat kamaráda');
  await page.getByRole('button', { name: 'Klíče k pokladu' }).click();
  ok(
    (await snap(page)).overlay?.kind === 'treasure' && (await page.locator('.chest').isVisible()) && (await page.getByRole('button', { name: 'Jdi na úkoly' }).isVisible()),
    'klíč nahoře je vidět i bez klíče: ukáže truhlu se 3 zámky a pošle k úkolům',
  );
  await page.screenshot({ path: `${OUT}/02b-treasure-empty.png` });
  await page.getByRole('button', { name: 'Zavřít' }).click();
  await page.getByRole('button', { name: 'Stavění z kostek' }).click();
  ok((await snap(page)).playMode === 'build' && (await page.getByRole('button', { name: 'kámen', exact: true }).isVisible()), 'kladivo zapne stavění z kostek (paleta)');
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
  // 5 dřevěných kostek na pole, která jsou z nějakého pohledu opravdu vidět
  const woodCells = [];
  for (const x of [1, 3, 5, 7, 9, 11, 13, 15]) for (const z of [4, 5, 6, 15]) woodCells.push({ x, y: 0, z });
  let placedWood = 0;
  for (const cell of woodCells) {
    if (placedWood >= 5) break;
    // mise už může být splněná (kostka mohla padnout i na sousední pole) – přes oslavu už neťukat
    const m1 = await snap(page);
    if (m1.completed.includes('wood5') || (m1.mission?.progress ?? 0) >= 5) break;
    if ((await blockAt(page, { ...cell, y: 1 })) !== null) continue;
    await tapVisible(page, cell);
    if ((await blockAt(page, { ...cell, y: 1 })) === 'wood') placedWood++;
    if (placedWood === 3) await page.screenshot({ path: `${OUT}/04-mission-wood-progress.png` });
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
  for (const t of targets) {
    await tapVisible(page, t);
    const left = await page.evaluate(() => window.__onda.controller.mission?.targets?.length ?? 'konec');
    if (process.env.DEBUG) console.log('    red', JSON.stringify(t), 'zbývá', left);
  }
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

  // --- MISE 4: nakrm zvířátka
  await page.getByRole('button', { name: 'Další úkol' }).click();
  ok((await snap(page)).overlay?.mission === 'feed', 'mise 4: nabídnuta jako další úkol');
  await page.screenshot({ path: `${OUT}/14-intro-feed.png` });
  await page.getByRole('button', { name: 'Jdeme na to!' }).click();
  await page.getByRole('button', { name: 'červená' }).click();
  ok(await tapCreature(page, 'sheep'), 'ovečku jde trefit');
  s = await snap(page);
  ok(s.mission?.progress === 0 && s.highlightMaterial === 'grass', 'mise 4: špatné jídlo = nic se nestane, jen nápověda (tráva bliká)');
  await page.screenshot({ path: `${OUT}/15-feed-bubbles.png` });
  for (const [animal, food] of [
    ['sheep', 'tráva'],
    ['chick', 'písek'],
    ['dog', 'dřevo'],
  ]) {
    await page.getByRole('button', { name: food }).click();
    for (let tries = 0; tries < 4; tries++) {
      await tapCreature(page, animal);
      const fed = await page.evaluate(() => window.__onda.controller.getSnapshot().mission?.fed ?? ['konec']);
      if (fed.includes(animal) || fed.includes('konec')) break;
    }
  }
  await sleep(1300);
  s = await snap(page);
  ok(s.completed.includes('feed') && s.overlay?.kind === 'success', 'mise 4: všechna zvířátka nakrmená');

  // --- MISE 5: domeček pro Freného (ťuknutí na svítící místo položí kostku přímo tam)
  await page.getByRole('button', { name: 'Další úkol' }).click();
  ok((await snap(page)).overlay?.mission === 'doghouse', 'mise 5: nabídnuta jako další úkol');
  await page.screenshot({ path: `${OUT}/16-intro-doghouse.png` });
  await page.getByRole('button', { name: 'Jdeme na to!' }).click();
  await page.getByRole('button', { name: 'dřevo' }).click();
  await settle(page);
  ok(
    await page.evaluate(() => {
      const v = window.__onda.view;
      const s = v.projectToScreen({ x: 3, y: 2, z: 11 }, 'center');
      return v.pick(s.x, s.y)?.kind === 'ghost';
    }),
    'mise 5: kamera sama ukáže místo domečku (střecha je vidět bez otáčení)',
  );
  await page.screenshot({ path: `${OUT}/17-doghouse-ghosts.png` });
  const parts = [
    { x: 2, y: 1, z: 11 },
    { x: 4, y: 1, z: 11 },
    { x: 3, y: 1, z: 12 },
    { x: 3, y: 2, z: 11 },
  ];
  let placedAll = true;
  for (const p of parts) placedAll = (await tapGhost(page, p)) && placedAll;
  ok(placedAll, 'mise 5: na každé svítící místo jde ťuknout (i střecha ve vzduchu)');
  ok((await blockAt(page, { x: 3, y: 2, z: 11 })) === 'wood', 'mise 5: střecha je přesně nad vnitřkem domečku');
  await page.waitForFunction(() => window.__onda.controller.getSnapshot().overlay?.kind === 'success', null, { timeout: 20000 }).catch(() => {});
  // headless Chromium vykresluje pomalu – počkáme, až Frený opravdu dojde
  await page.waitForFunction(() => !window.__onda.controller.animals.get('dog').walking, null, { timeout: 60000 }).catch(() => {});
  s = await snap(page);
  const dogCell = await page.evaluate(() => window.__onda.controller.animals.get('dog').standCell);
  ok(s.completed.includes('doghouse') && s.overlay?.kind === 'success', 'mise 5: domeček hotový, oslava');
  await page.locator('.key-reward').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  ok(
    s.overlay?.keyAwarded === true && s.keys.includes('island') && (await page.locator('.key-reward').isVisible()),
    `za všechny úkoly klíč k pokladu (${JSON.stringify({ ov: s.overlay, keys: s.keys, vis: await page.locator('.key-reward').count() })})`,
  );
  await page.screenshot({ path: `${OUT}/18b-key-reward.png` });
  ok(dogCell.x === 3 && dogCell.y === 1 && dogCell.z === 11, `Frený vlezl do domečku (${JSON.stringify(dogCell)})`);
  await page.getByRole('button', { name: 'Stavět dál' }).click();
  s = await snap(page);
  ok(s.overlay?.kind === 'treasure' && s.overlay.fresh === true, 'po posledním úkolu oslava s truhlou pokladu');
  await page.locator('.key-in').first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  ok((await page.locator('.key-in').count()) === 1, 'klíč je v prvním ze 3 zámků');
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/18c-treasure-fresh.png` });
  await page.getByRole('button', { name: 'Zavřít' }).click();
  await page.screenshot({ path: `${OUT}/18-doghouse-done.png` });
  ok(!(await page.getByRole('button', { name: 'Další úkol' }).count()), 'po všech misích už „Další úkol“ není');

  // --- zvířátko
  // (Frený teď spí v domečku pod střechou – zkusíme ovečku)
  ok(await tapCreature(page, 'sheep'), 'ťuknutí na ovečku trefí zvířátko');

  // --- postavičky: Ondra dojde bránou na nádvoří hradu
  await page.getByRole('button', { name: 'Chození' }).click();
  ok(await page.locator('.keys-btn').isVisible(), 'klíč je nahoře v liště');
  await page.getByRole('button', { name: 'Ondra' }).click();
  ok((await snap(page)).selectedCharacter === 'ondra', 'postavička se vybere tlačítkem s obličejem');
  await page.screenshot({ path: `${OUT}/12-ondra-selected.png` });
  const court = { x: 11, y: 0, z: 11 };
  ok(await tapVisible(page, court), 'nádvoří hradu je vidět a dá se na něj ťuknout');
  ok((await snap(page)).selectedCharacter === 'ondra', 'v režimu chození zůstává postavička vybraná');
  ok((await blockAt(page, { x: 10, y: 1, z: 12 })) === null, 'ťuknutí s vybranou postavičkou nepostaví kostku');
  await page.waitForFunction(() => !window.__onda.controller.characters.get('ondra').walking, null, { timeout: 30000 });
  const ondra = await page.evaluate(() => window.__onda.controller.characters.get('ondra').standCell);
  ok(ondra.x === 11 && ondra.y === 1 && ondra.z === 11, `Ondra došel na nádvoří hradu (${JSON.stringify(ondra)})`);
  await page.screenshot({ path: `${OUT}/13-ondra-in-castle.png` });

  // Laura se dá vybrat i ťuknutím přímo na ni ve světě
  await tapCreature(page, 'lauriska');
  ok((await snap(page)).selectedCharacter === 'lauriska', 'ťuknutí na Lauru ve světě ji vybere');
  await page.getByRole('button', { name: 'Laura' }).click();
  ok((await snap(page)).selectedCharacter === null, 'druhé ťuknutí výběr zruší');

  // --- Ondra a Laura se potkají: Laura dojde k Ondrovi na nádvoří
  await page.getByRole('button', { name: 'Laura' }).click();
  ok(await tapVisible(page, { x: 11, y: 0, z: 12 }), 'místo vedle Ondry je vidět');
  await page.waitForFunction(() => !window.__onda.controller.characters.get('lauriska').walking, null, { timeout: 60000 }).catch(() => {});
  await sleep(300);
  const met = await page.evaluate(() => {
    const c = window.__onda.controller;
    const w = window.__onda.world();
    return {
      at: c.lastMeetAt,
      l: c.characters.get('lauriska').standCell,
      o: c.characters.get('ondra').standCell,
      ow: c.characters.get('ondra').walking,
      ov: c.getSnapshot().overlay?.kind ?? null,
      boxes: [...w.entries()].filter(([, t]) => t === 'question').map(([k]) => k),
    };
  });
  if (!met.at) console.log('    (setkání stav:', JSON.stringify(met), ')');
  ok(met.at > 0, `Ondra a Laura se potkali – srdíčka a rozhovor (Laura ${JSON.stringify(met.l)})`);
  await page.screenshot({ path: `${OUT}/13b-friends-meet.png` });
  await page.getByRole('button', { name: 'Laura' }).click();

  // --- bedna s otazníkem: bez postavičky jen nápověda, s Laurou úkol
  const box = { x: 15, y: 1, z: 15 };
  ok((await blockAt(page, box)) === 'question', 've světě je bedna s otazníkem');
  ok(await tapVisible(page, box), 'bedna je vidět');
  ok((await snap(page)).nudgeCharacters === true && (await blockAt(page, box)) === 'question', 'ťuknutí na bednu bez postavičky: rozblikají se postavičky, bedna zůstane');
  await page.getByRole('button', { name: 'Laura' }).click();
  await tapVisible(page, box);
  await page.waitForFunction(() => window.__onda.controller.getSnapshot().overlay?.kind === 'quiz', null, { timeout: 120000 }).catch(() => {});
  let q = (await snap(page)).overlay;
  if (q?.kind !== 'quiz')
    console.log(
      '    (stav:',
      JSON.stringify(
        await page.evaluate(() => {
          const c = window.__onda.controller;
          const l = c.characters.get('lauriska');
          return { l: l.standCell, walking: l.walking, sel: c.getSnapshot().selectedCharacter, mode: c.getSnapshot().playMode, ov: c.getSnapshot().overlay?.kind };
        }),
      ),
      ')',
    );
  ok(q?.kind === 'quiz' && q.quiz.options.length === 3, `Laura došla k bedně a otevřel se úkol (${q?.quiz?.kind})`);
  await page.screenshot({ path: `${OUT}/19-quiz.png` });
  const wrongOpts = q.quiz.options.filter((o) => o !== q.quiz.answer);
  for (const o of wrongOpts) await page.locator('.quiz-option').nth(q.quiz.options.indexOf(o)).click();
  q = (await snap(page)).overlay;
  ok(q.wrong.length === 2 && q.help === true && !q.solved, 'úkol: 2 špatné odpovědi = správná se rozsvítí (žádný trest)');
  await page.locator('.quiz-option').nth(q.quiz.options.indexOf(q.quiz.answer)).click();
  ok((await snap(page)).overlay?.solved === true, 'úkol: správná odpověď = pochvala');
  await page.screenshot({ path: `${OUT}/20-quiz-solved.png` });
  await page.waitForFunction(() => window.__onda.controller.getSnapshot().overlay === null, null, { timeout: 5000 }).catch(() => {});
  ok((await blockAt(page, box)) === null, 'bedna se po vyřešení otevře (zmizí)');
  const boxInfo = await page.evaluate(() => {
    const c = window.__onda.controller;
    const w = window.__onda.world();
    const boxes = [...w.entries()].filter(([, t]) => t === 'question').map(([k]) => k);
    for (const k of boxes.slice(1)) {
      const [x, y, z] = k.split(',').map(Number);
      w.deleteRaw({ x, y, z });
    }
    c.nextBoxAt = Date.now() - 1; // místo 30 s čekání
    return { before: w.count('question'), recent: c.recentBoxes };
  });
  await page.waitForFunction(() => window.__onda.world().count('question') >= 2, null, { timeout: 15000 }).catch(() => {});
  const newBoxes = await page.evaluate(() => [...window.__onda.world().entries()].filter(([, t]) => t === 'question').map(([k]) => k));
  ok(newBoxes.length >= 2 && !newBoxes.includes(`${box.x},${box.y},${box.z}`), `po vyřešení se objeví nová bedna na jiném místě (${boxInfo.before} → ${newBoxes.length})`);
  // pojistka: kdyby bedny někdy zmizely všechny, hned se objeví nová
  await page.evaluate(() => {
    const w = window.__onda.world();
    for (const [k, t] of [...w.entries()]) if (t === 'question') {
      const [x, y, z] = k.split(',').map(Number);
      w.deleteRaw({ x, y, z });
    }
  });
  await page.waitForFunction(() => window.__onda.world().count('question') >= 1, null, { timeout: 8000 }).catch(() => {});
  ok((await page.evaluate(() => window.__onda.world().count('question'))) >= 1, 've světě nikdy nezůstane žádná bedna');

  // --- automatické ukládání + obnova po reloadu
  await sleep(600);
  await page.reload();
  await page.waitForFunction(() => !!window.__onda);
  ok((await blockAt(page, { x: bx, y: 1, z: 7 })) === 'wood', 'svět se po obnovení stránky načte (most zůstal)');
  ok((await snap(page)).completed.length === 5, 'hvězdičky všech 5 misí zůstaly uložené');
  ok((await snap(page)).keys.includes('island'), 'klíč k pokladu zůstal uložený');
  const ondraAfter = await page.evaluate(() => window.__onda.controller.characters.get('ondra').standCell);
  ok(ondraAfter.x === 11 && ondraAfter.z === 11, 'Ondra zůstal po obnovení stránky na hradě');
  await page.getByRole('button', { name: 'Hrát' }).click();
  await page.screenshot({ path: `${OUT}/09-after-reload.png` });

  // --- rodičovská zóna
  await page.getByRole('button', { name: 'Pro rodiče' }).click();
  const gateQ = await page.locator('.gate h2').textContent();
  const [a, b] = gateQ.match(/\d+/g).map(Number);
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

  // --- Stavitel: ve výchozím světě není na hrad místo → prázdná louka → postavit hrad
  await page.getByRole('button', { name: 'Stavitel' }).click();
  ok((await snap(page)).overlay?.kind === 'architect', 'ikona hradu otevře menu Stavitele');
  await page.getByRole('button', { name: 'Hrad', exact: true }).click();
  ok((await snap(page)).overlay?.noRoom === 'castle', 'když není místo, hra poradí prázdnou louku');
  await page.screenshot({ path: `${OUT}/21-architect-menu.png` });
  await page.getByRole('button', { name: 'Prázdná louka' }).click();
  ok((await snap(page)).overlay?.kind === 'meadowConfirm', 'louka se nejdřív potvrzuje');
  await page.getByRole('button', { name: 'Ano' }).click();
  const above = await page.evaluate(() => [...window.__onda.world().entries()].filter(([k]) => Number(k.split(',')[1]) > 0).length);
  ok(above === (await page.evaluate(() => window.__onda.world().count('question'))) && above >= 3, `prázdná louka: zůstala jen zem a hned jsou tu bedny s otazníkem (${above})`);
  await page.getByRole('button', { name: 'Stavitel' }).click();
  await page.getByRole('button', { name: 'Hrad', exact: true }).click();
  s0 = await snap(page);
  ok(s0.playMode === 'architect' && s0.template?.id === 'castle' && s0.template.filled === 0, 'šablona hradu začala');
  await settle(page);
  await page.screenshot({ path: `${OUT}/22-architect-ghosts.png` });
  for (let guard = 0; guard < 80; guard++) {
    const t = (await snap(page)).template;
    if (!t) break;
    const ghosts = await page.evaluate(() => window.__onda.view.effects.ghostObjects().map((o) => o.userData.ghostPos));
    if (!ghosts.length) break;
    let placed = false;
    for (const g of ghosts.slice(0, 3)) {
      if (await tapGhost(page, g)) {
        placed = true;
        break;
      }
    }
    if (!placed) break;
    if (t.filled === 12) await page.screenshot({ path: `${OUT}/23-architect-half.png` });
  }
  await page.waitForFunction(() => window.__onda.controller.getSnapshot().overlay?.kind === 'templateDone', null, { timeout: 5000 }).catch(() => {});
  ok((await snap(page)).overlay?.kind === 'templateDone', 'hrad ze šablony je hotový');
  await page.getByRole('button', { name: 'Stavět dál' }).click();
  ok((await snap(page)).playMode === 'walk', 'po stavbě se přepne na chození (pošli kamaráda dovnitř)');
  await page.screenshot({ path: `${OUT}/24-architect-done.png` });

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
  await page.screenshot({ path: `${OUT}/30-iphone-start.png` });
  await page.getByRole('button', { name: 'Hrát' }).tap();
  await page.getByRole('button', { name: 'Stavění z kostek' }).tap();
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
  await page.screenshot({ path: `${OUT}/31-iphone-world.png` });
  await page.getByRole('button', { name: 'Úkoly' }).tap();
  await page.getByRole('button', { name: 'Most přes řeku' }).tap();
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/32-iphone-intro.png` });
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
