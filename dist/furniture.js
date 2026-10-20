(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AfterhoursFurniture = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const catalog = {
    sofa: { name: 'Blue velvet sofa', cell: 0, w: 2, d: 1, width: 240, price: 80 },
    decks: { name: 'Walnut DJ console', cell: 1, w: 2, d: 1, width: 238, price: 90 },
    speaker: { name: 'Studio speaker', cell: 2, w: 1, d: 1, width: 94, price: 45 },
    plant: { name: 'Potted palm', cell: 3, w: 1, d: 1, width: 118, price: 40 },
    lamp: { name: 'Amber floor lamp', cell: 4, w: 1, d: 1, width: 72, price: 40 },
    table: { name: 'Candle table', cell: 5, w: 1, d: 1, width: 120, price: 40 },
    seat: { name: 'Purple lounge chair', cell: 6, w: 1, d: 1, width: 150, price: 40 },
    records: { name: 'Record crate', cell: 7, w: 1, d: 1, width: 100, price: 30 },
    jukebox: { name: 'Afterhours jukebox', cell: 8, w: 1, d: 1, width: 125, price: 100 },
    vending: { name: 'Soda machine', cell: 9, w: 1, d: 1, width: 115, price: 65 },
    portal: { name: 'Music portal', cell: 10, w: 1, d: 1, width: 140, price: 85 },
    dice: { name: 'Game dice', cell: 11, w: 1, d: 1, width: 85, price: 35 },
    notice: { name: 'Message board', cell: 12, w: 1, d: 1, width: 155, price: 30 },
    bowl: { name: 'Pet bowl', cell: 13, w: 1, d: 1, width: 65, price: 20 },
    gift: { name: 'Gift box', cell: 15, w: 1, d: 1, width: 85, price: 25 }
  };
  const footprint = item => {
    const c = catalog[item.type];
    return item.rot % 2 ? { w: c.d, d: c.w } : { w: c.w, d: c.d };
  };
  function tiles(item) {
    const { w, d } = footprint(item), result = [];
    for (let x = item.x; x < item.x + w; x++)
      for (let y = item.y; y < item.y + d; y++) result.push(`${x},${y}`);
    return result;
  }
  function canPlace(item, items, actor) {
    const { w, d } = footprint(item);
    if (item.x < 1 || item.y < 1 || item.x + w > 9 || item.y + d > 9) return false;
    const occupied = new Set(items.filter(d => d.id !== item.id && d.placed !== false).flatMap(tiles));
    if (actor) occupied.add(`${Math.floor(actor.x)},${Math.floor(actor.y)}`);
    return tiles(item).every(k => !occupied.has(k));
  }
  function normalize(old) {
    return (old || []).filter(d => catalog[d.type]).map((d, i) => ({
      ...d, id: d.id || `owned-${i}`, type: d.type, x: Math.floor(d.x), y: Math.floor(d.y),
      rot: d.rot || 0, placed: d.placed !== false
    }));
  }
  function starter() {
    return [
      { id: 'starter-sofa', type: 'sofa', x: 1, y: 5, rot: 1, placed: true },
      { id: 'starter-decks', type: 'decks', x: 5, y: 1, rot: 0, placed: true },
      { id: 'starter-speaker', type: 'speaker', x: 7, y: 1, rot: 0, placed: true },
      { id: 'starter-plant', type: 'plant', x: 1, y: 2, rot: 0, placed: true },
      { id: 'starter-lamp', type: 'lamp', x: 1, y: 7, rot: 0, placed: true },
      { id: 'starter-table', type: 'table', x: 3, y: 5, rot: 0, placed: true },
      { id: 'starter-seat', type: 'seat', x: 7, y: 6, rot: 0, placed: true },
      { id: 'starter-records', type: 'records', x: 6, y: 2, rot: 0, placed: true }
    ];
  }
  return { catalog, footprint, tiles, canPlace, normalize, starter };
});
