// Wave 1 runtime check: drives the published Uno app in Chromium at four widths and checks that the
// XAML chrome shows the game's state and runs its commands. Usage:
//   node scripts/verify-wave1.mjs [baseUrl] [outDir]
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const {chromium} = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://127.0.0.1:4177/';
const out = process.argv[3] || 'docs/screenshots/xaml/wave1';
await mkdir(out, {recursive: true});
const results = [];
const record = (key, pass, detail = {}) => { results.push({key, pass, ...detail}); console.log(pass ? 'PASS' : 'FAIL', key, JSON.stringify(detail)); };

const browser = await chromium.launch({args: ['--autoplay-policy=user-gesture-required']});

async function open(width, height) {
  const context = await browser.newContext({viewport: {width, height}});
  const page = await context.newPage();
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.__contexts = [];
    window.AudioContext = class extends Native { constructor(...a) { super(...a); window.__contexts.push(this); } };
  });
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) failed.push(r.url() + ' ' + r.status()); });
  await page.goto(base);
  await page.waitForFunction(() => window.AfterhoursWorld && document.querySelector('.ah-root canvas#room'), null, {timeout: 120000});
  await page.getByText('Opening your world…').waitFor({state: 'detached', timeout: 30000}).catch(() => {});
  await page.waitForTimeout(1200);
  return {context, page, errors, failed};
}

// Text of a XAML element outside the hosted room (Uno renders text as leaf elements).
const xamlText = (page, pattern) => page.evaluate(source => {
  const re = new RegExp(source);
  return [...document.querySelectorAll('*')].filter(e => !e.closest('.ah-root') && e.childElementCount === 0 && re.test(e.textContent.trim()))
    // Uno keeps a collapsed element's box and hides it with CSS, so check real visibility.
    .filter(e => e.getBoundingClientRect().width > 0 && e.checkVisibility({visibilityProperty: true, opacityProperty: true}))
    .map(e => e.textContent.trim());
}, pattern.source);
const visible = async (page, text) => (await xamlText(page, new RegExp('^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))).length > 0;
// Clicks the visible XAML element whose own text is exactly `text` (labels, or icon glyphs).
const xamlClick = async (page, text) => {
  const box = await page.evaluate(t => {
    const el = [...document.querySelectorAll('*')].find(e => !e.closest('.ah-root') && e.childElementCount === 0 && e.textContent.trim() === t
      && e.getBoundingClientRect().width > 0 && e.checkVisibility({visibilityProperty: true, opacityProperty: true}));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x: r.x + r.width / 2, y: r.y + r.height / 2};
  }, text);
  if (!box) throw Error('No visible XAML element with text ' + JSON.stringify(text));
  await page.mouse.click(box.x, box.y);
};
const closeGameDialog = page => page.evaluate(() => { const d = document.querySelector('.ah-root #modal'); if (d?.open) d.close(); });
const game = (page, fn) => page.evaluate(fn);

for (const [width, height, band] of [[1440, 900, 'wide'], [1000, 800, 'normal'], [800, 900, 'narrow'], [390, 844, 'phone']]) {
  const {context, page, errors, failed} = await open(width, height);
  const tag = `${band} ${width}px`;
  await page.screenshot({path: path.join(out, `${band}-${width}.png`)});

  const coins = await game(page, () => AfterhoursWorld.game.state.coins);
  record(`${tag}: boot panel gone, coins shown`, !(await visible(page, 'Opening your world…')) && await visible(page, String(coins)), {coins});

  const title = (await game(page, () => document.querySelector('.ah-root #roomTitle').textContent.replace(/\.$/, ''))).toUpperCase();
  record(`${tag}: room heading mirrors the game`, await visible(page, title), {title});

  const rail = await visible(page, 'Explore'), railIcons = await visible(page, '\uE774');
  const chatColumn = await visible(page, 'Room chat');
  const expected = {wide: {rail: true, chat: true}, normal: {rail: false, chat: false}, narrow: {rail: false, chat: false}, phone: {rail: false, chat: false}}[band];
  record(`${tag}: rail labels and chat column follow the breakpoints`, rail === expected.rail && chatColumn === expected.chat, {rail, railIcons, chatColumn});

  if (band === 'wide') {
    // Daily gift through the XAML resident card: the game pays 35 and opens its journal.
    await xamlClick(page, 'Daily gift · 35 ✦');
    await page.waitForTimeout(700);
    const after = await game(page, () => AfterhoursWorld.game.state.coins);
    await closeGameDialog(page);
    await page.waitForTimeout(300);
    record(`${tag}: daily gift pays and the HUD follows`, after === coins + 35 && await visible(page, String(after)) && await visible(page, 'Checked in ✓'), {after});

    // Travel from the XAML room list.
    await xamlClick(page, 'Midnight Diner');
    await page.waitForTimeout(900);
    record(`${tag}: room list travels`, await visible(page, 'MIDNIGHT DINER') && await game(page, () => AfterhoursWorld.roomKey()) === 'public:1');

    // Dance toggles and its label follows the game.
    await xamlClick(page, 'Dance');
    await page.waitForTimeout(400);
    record(`${tag}: dance runs and relabels`, await visible(page, 'Stop dancing'));
    await xamlClick(page, 'Stop dancing');

    // Room keys stay with the room: '1'/'2' typed while a XAML button has focus must not act.
    const before = await game(page, () => document.querySelector('.ah-root #dance').textContent);
    await page.keyboard.press('2');
    await page.waitForTimeout(300);
    const unchanged = await game(page, () => document.querySelector('.ah-root #dance').textContent) === before;
    record(`${tag}: room shortcuts ignore XAML focus`, unchanged);

    // Chat from the XAML composer reaches the game's chat and comes back as a line.
    // Uno draws the placeholder as its own text, so find the XAML text input outside the room.
    const inputs = page.locator('input, textarea');
    const index = await inputs.evaluateAll(all => all.findIndex(e => !e.closest('.ah-root') && e.getBoundingClientRect().width > 0));
    const box = inputs.nth(index);
    await box.click();
    // Real keystrokes: Uno's TextBox listens for input events that fill() does not raise.
    await page.keyboard.type('hello from xaml', {delay: 15});
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const inGame = await game(page, () => [...document.querySelectorAll('.ah-root #messages .message p')].some(p => p.textContent === 'hello from xaml'));
    record(`${tag}: chat sends through the game and lists the line`, inGame && await visible(page, 'hello from xaml'), {inGame});

    // My room, decorate, editor bar, done.
    await xamlClick(page, 'My room');
    await page.waitForTimeout(900);
    await xamlClick(page, 'Decorate');
    await page.waitForTimeout(600);
    const editing = await visible(page, 'Done');
    await page.screenshot({path: path.join(out, `${band}-editor.png`)});
    await xamlClick(page, 'Done');
    await page.waitForTimeout(700);
    const closed = await game(page, () => document.querySelector('.ah-root #roomEditor').hidden);
    await page.screenshot({path: path.join(out, `${band}-after-done.png`)});
    record(`${tag}: decorate shows the XAML editor bar and Done closes it`, editing && closed && !(await visible(page, 'Done')), {editing, closed, doneStillShown: await xamlText(page, /^Done$/)});

    // Music from the XAML now-playing bar starts the game's audio.
    await xamlClick(page, '▶');
    await page.waitForTimeout(1200);
    const audio = await game(page, () => window.__contexts.map(c => c.state));
    record(`${tag}: play starts audio and shows pause`, audio.includes('running') && await visible(page, 'Ⅱ'), {audio});
    await xamlClick(page, 'Ⅱ');

    // A game panel opened from XAML.
    await xamlClick(page, 'Catalog');
    await page.waitForTimeout(500);
    record(`${tag}: dock opens a game panel`, await game(page, () => document.querySelector('.ah-root #modal').open));
    await page.screenshot({path: path.join(out, `${band}-game-panel.png`)});
    await closeGameDialog(page);

    const portrait = await page.evaluate(() => [...document.images].filter(i => !i.closest('.ah-root')).map(i => i.naturalWidth));
    record(`${tag}: portrait renders`, portrait.some(w => w > 0), {portrait});
  }

  if (band === 'phone') {
    await xamlClick(page, '\uE8BD');
    await page.waitForTimeout(600);
    await page.screenshot({path: path.join(out, `${band}-chat.png`)});
    record(`${tag}: chat opens from the bottom bar`, await visible(page, 'Room chat'));
  }

  record(`${tag}: no page errors or failed requests`, !errors.length && !failed.length, {errors: errors.slice(0, 3), failed: failed.slice(0, 3)});
  await context.close();
}

// Shared world: two players join through the XAML shared-world button and the game's join form,
// then a line typed in one player's XAML chat reaches the other player's XAML chat.
{
  const players = [];
  for (const name of ['xamlalpha', 'xamlbeta']) {
    const p = await open(1440, 900);
    await xamlClick(p.page, 'JOIN SHARED WORLD');
    await p.page.waitForTimeout(500);
    await p.page.evaluate(n => { document.querySelector('.ah-root #onlineName').value = n; document.querySelector('.ah-root #joinWorldForm').requestSubmit(); }, name);
    await p.page.waitForFunction(() => window.AfterhoursOnline?.connected(), null, {timeout: 20000});
    await closeGameDialog(p.page);
    await p.page.waitForTimeout(1500);
    players.push(p);
  }
  const [a, b] = players;
  record('shared: both players show SHARED WORLD in the XAML top bar', await visible(a.page, 'SHARED WORLD') && await visible(b.page, 'SHARED WORLD'));
  const inputs = a.page.locator('input, textarea');
  const index = await inputs.evaluateAll(all => all.findIndex(e => !e.closest('.ah-root') && e.getBoundingClientRect().width > 0));
  await inputs.nth(index).click();
  await a.page.keyboard.type('hi from the other tab', {delay: 15});
  await a.page.keyboard.press('Enter');
  await b.page.waitForFunction(() => [...document.querySelectorAll('.ah-root #messages .message p')].some(p => p.textContent.includes('hi from the other tab')), null, {timeout: 20000}).catch(() => {});
  await b.page.waitForTimeout(600);
  await b.page.screenshot({path: path.join(out, 'shared-receiver.png')});
  record('shared: a XAML chat line reaches the other player\'s XAML chat', (await xamlText(b.page, /hi from the other tab/)).length > 0);
  for (const p of players) {
    record('shared: no page errors', !p.errors.length, {errors: p.errors.slice(0, 3)});
    await p.context.close();
  }
}

await browser.close();
await writeFile(path.join(out, 'results.json'), JSON.stringify({base, date: new Date().toISOString(), results}, null, 2));
const failures = results.filter(r => !r.pass).length;
console.log(`${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
