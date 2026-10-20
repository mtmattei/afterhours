(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AfterhoursMovement = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const key = p => `${Math.floor(p.x)},${Math.floor(p.y)}`;
  const center = p => ({ x: Math.floor(p.x) + .5, y: Math.floor(p.y) + .5 });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  function route(start, target, options = {}) {
    const min = options.min ?? 2, max = options.max ?? 8;
    const blocked = options.blocked || new Set();
    const source = center(start), requested = center(target);
    const inside = p => p.x >= min && p.x < max + 1 && p.y >= min && p.y < max + 1;
    const free = p => inside(p) && (!blocked.has(key(p)) || key(p) === key(source));
    if (!inside(requested)) return null;
    // Dijkstra on a tiny room grid also finds a reachable tile beside an occupied target.
    const open = [{ ...source, cost: 0 }], costs = new Map([[key(source), 0]]), previous = new Map();
    const visited = new Map();
    while (open.length) {
      open.sort((a, b) => a.cost - b.cost);
      const current = open.shift(), ck = key(current);
      if (visited.has(ck)) continue;
      visited.set(ck, current);
      for (const [dx, dy] of directions) {
        const next = { x: current.x + dx, y: current.y + dy }, nk = key(next);
        if (!free(next)) continue;
        // Never cut diagonally through the corner of a sofa or another avatar.
        if (dx && dy && (!free({ x: current.x + dx, y: current.y }) ||
            !free({ x: current.x, y: current.y + dy }))) continue;
        const cost = current.cost + Math.hypot(dx, dy);
        if (cost >= (costs.get(nk) ?? Infinity)) continue;
        costs.set(nk, cost); previous.set(nk, ck); open.push({ ...next, cost });
      }
    }
    const reachable = [...visited.values()].sort((a, b) =>
      distance(a, requested) - distance(b, requested) || a.cost - b.cost);
    const goal = reachable[0];
    if (!goal) return null;
    // A blocked target must have a reachable neighbor, not an unrelated far-away tile.
    if (distance(goal, requested) > 1.5) return null;
    const result = [];
    let cursor = key(goal);
    while (cursor !== key(source)) {
      const node = visited.get(cursor);
      result.unshift({ x: node.x, y: node.y });
      cursor = previous.get(cursor);
      if (cursor === undefined) return null;
    }
    return { nodes: result, goal: { x: goal.x, y: goal.y } };
  }

  class Walker {
    constructor(actor, options) {
      this.actor = actor;
      this.getOptions = options;
      this.path = [];
      this.speed = 0;
      this.maxSpeed = 2.6;
      this.acceleration = 22;
      this.braking = 30;
      this.phase = 0;
      this.back = false;
      this.flip = false;
      this.moving = false;
      this.totalDistance = 0;
      this.goal = { x: actor.x, y: actor.y };
    }
    goTo(point) {
      // Finish the current partial step, then take the new route. No snapping or rewind.
      const anchor = this.path[0] || center(this.actor);
      const planned = route(anchor, point, this.getOptions());
      if (!planned) return false;
      this.path = (distance(this.actor, anchor) > .001 ? [{ ...anchor }] : []).concat(planned.nodes);
      this.goal = planned.goal;
      this.actor.tx = this.goal.x; this.actor.ty = this.goal.y;
      return true;
    }
    stop() {
      this.path = []; this.speed = 0; this.moving = false;
      this.goal = { x: this.actor.x, y: this.actor.y };
      this.actor.tx = this.actor.x; this.actor.ty = this.actor.y;
    }
    reset(x, y) {
      this.actor.x = x; this.actor.y = y; this.phase = 0; this.stop();
    }
    update(dt) {
      // Substeps make stopping and gait distance independent of display refresh rate.
      let remaining = Math.min(Math.max(dt, 0), .1);
      while (remaining > 1e-8) {
        const slice = Math.min(remaining, 1 / 120);
        this.advance(slice); remaining -= slice;
      }
    }
    advance(dt) {
      if (!this.path.length) { this.speed = 0; this.moving = false; return; }
      let total = distance(this.actor, this.path[0]);
      for (let i = 1; i < this.path.length; i++) total += distance(this.path[i - 1], this.path[i]);
      const wanted = Math.min(this.maxSpeed, Math.sqrt(2 * this.braking * total));
      this.speed += Math.max(-this.braking * dt, Math.min(this.acceleration * dt, wanted - this.speed));
      let travel = this.speed * dt, covered = 0;
      while (travel > 0 && this.path.length) {
        const next = this.path[0], dx = next.x - this.actor.x, dy = next.y - this.actor.y;
        const length = Math.hypot(dx, dy);
        if (length < .0001) { this.path.shift(); continue; }
        const amount = Math.min(travel, length);
        const screenX = dx - dy, screenY = dx + dy;
        if (Math.abs(screenY) > .0001) this.back = screenY < 0;
        if (Math.abs(screenX) > .0001) this.flip = screenX < 0;
        this.actor.x += dx / length * amount;
        this.actor.y += dy / length * amount;
        covered += amount; travel -= amount;
        if (amount >= length - 1e-8) {
          this.actor.x = next.x; this.actor.y = next.y; this.path.shift();
        }
      }
      this.phase += covered * Math.PI * 2 / 1.15;
      this.totalDistance += covered;
      this.moving = this.path.length > 0;
      if (!this.moving) {
        this.speed = 0;
        // Land on a contact pose instead of freezing mid-stride.
        this.phase = Math.round(this.phase / Math.PI) * Math.PI;
      }
    }
  }
  return { Walker, route, center, key };
});
