(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./movement.js'), require('./furniture.js'));
  else root.AfterhoursSeating = factory(root.AfterhoursMovement, root.AfterhoursFurniture);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Movement, Furniture) {
  const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < .001;
  function slots(item) {
    const seats = Furniture.catalog[item.type]?.seats;
    if (item.placed === false || !seats?.length) return [];
    const count = seats.length, { w, d } = Furniture.footprint(item);
    return Array.from({ length: count }, (_, index) => ({
      id: `${item.id}:${index}`, itemId: item.id, index,
      // Approach the open front edge, never through the back or arm of the sofa.
      approaches: [item.rot
        ? { x: item.x + w + .5, y: item.y + index + .5 }
        : { x: item.x + index + .5, y: item.y + d + .5 }],
      flip: !item.rot,
      anchor: seats[index]
    }));
  }
  function plan(offers, actor, options, occupied = new Set()) {
    const candidates = [];
    offers.forEach((offer, priority) => {
      if (occupied.has(offer.id)) return;
      for (const point of offer.approaches) {
        if (options.blocked?.has(Movement.key(point))) continue;
        const route = Movement.route(actor, point, options);
        // General walking can choose a nearby tile. Sitting requires the actual entrance.
        if (!route || !same(route.goal, point)) continue;
        let cost = 0, previous = actor;
        for (const node of route.nodes) {
          cost += Math.hypot(node.x - previous.x, node.y - previous.y); previous = node;
        }
        candidates.push({ offer, approach: point, cost, priority });
      }
    });
    candidates.sort((a, b) => a.priority - b.priority || a.cost - b.cost);
    return candidates[0] || null;
  }
  class Controller {
    constructor(walker, navigation, exists) {
      this.walker = walker; this.navigation = navigation; this.exists = exists;
      this.mode = 'standing'; this.target = null; this.settle = 0;
    }
    request(offers, occupied) {
      const origin = this.walker.path[0] || this.walker.actor;
      const chosen = plan(offers, origin, this.navigation(), occupied);
      if (!chosen) return false;
      if (!this.walker.goTo(chosen.approach)) return false;
      this.target = chosen; this.mode = 'approaching'; this.settle = 0;
      return true;
    }
    stand() { this.target = null; this.mode = 'standing'; this.settle = 0; }
    update(dt) {
      if (!this.target) return;
      if (!this.exists(this.target.offer)) { this.walker.stop(); this.stand(); return; }
      if (this.mode === 'approaching' && !this.walker.path.length) {
        if (same(this.walker.actor, this.target.approach)) this.mode = 'sitting';
        else this.stand();
      }
      if (this.mode === 'sitting') this.settle = Math.min(1, this.settle + dt / .2);
    }
  }
  return { slots, plan, Controller };
});
