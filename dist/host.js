// Mounts the game inside an element owned by the Uno app, in the same page.
// The C# side imports this module with JSHost.ImportAsync and passes a callback for events.
const base = new URL('./', import.meta.url);
let sink = () => {}, world = null, pending = null, lastSent = 0;

function emit(event) {
  try { sink(JSON.stringify(event)); } catch (e) { console.error('Afterhours host event failed', e); }
}

function pushState() {
  pending = null; lastSent = performance.now();
  emit({ type: 'state', state: world.game.state });
}

function scheduleState() {
  if (pending) return;
  const wait = Math.max(0, 100 - (performance.now() - lastSent));
  pending = setTimeout(pushState, wait);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(src, base).href;
    script.onload = resolve;
    script.onerror = () => reject(Error('Could not load ' + src));
    document.head.append(script);
  });
}

export async function mount(elementId, onEvent) {
  sink = onEvent;
  const root = document.getElementById(elementId);
  if (!root) throw Error('Missing host element ' + elementId);
  root.classList.add('ah-root');
  // Game scripts load art by relative path; resolve it against game/ instead of the Uno page.
  window.AfterhoursBase = base.href;

  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = new URL('scoped.css', base).href;
  const styled = new Promise(resolve => { style.onload = resolve; style.onerror = resolve; });
  document.head.append(style);

  const page = new DOMParser().parseFromString(await (await fetch(new URL('index.html', base))).text(), 'text/html');
  const scripts = [...page.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  for (const node of [...page.body.childNodes]) if (node.nodeName !== 'SCRIPT') root.append(document.importNode(node, true));
  await styled;
  for (const src of scripts) await loadScript(src);

  world = window.AfterhoursWorld;
  const save = world.game.save.bind(world.game);
  world.game.save = (...args) => { const out = save(...args); scheduleState(); return out; };
  emit({ type: 'ready', scripts: scripts.length });
  pushState();
}

export function dispatch(type, payloadJson) {
  try {
    world.saveWorld();
    const result = world.game.dispatch(type, JSON.parse(payloadJson || '{}'));
    world.sync();
    return JSON.stringify({ ok: true, result: result ?? null });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e.message });
  }
}

export async function playDraft() {
  await world.playSong(world.game.state.draft);
}

export function stopMusic() { world.stopMusic(); }

export function focusRoom() { world.canvas.focus(); }
