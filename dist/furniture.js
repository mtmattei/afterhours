(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AfterhoursFurniture = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const catalog = {
    sofa: { name: 'Blue velvet sofa', seats: [[.35,.43],[.61,.56]], cell: 0, w: 2, d: 1, width: 240, price: 80 },
    decks: { name: 'Walnut DJ console', cell: 1, w: 2, d: 1, width: 238, price: 90 },
    speaker: { name: 'Studio speaker', cell: 2, w: 1, d: 1, width: 94, price: 45 },
    plant: { name: 'Potted palm', cell: 3, w: 1, d: 1, width: 118, price: 40 },
    lamp: { name: 'Amber floor lamp', cell: 4, w: 1, d: 1, width: 72, price: 40 },
    table: { name: 'Candle table', cell: 5, w: 1, d: 1, width: 120, price: 40 },
    seat: { name: 'Purple lounge chair', seats: [[.53,.44]], cell: 6, w: 1, d: 1, width: 150, price: 40 },
    records: { name: 'Record crate', cell: 7, w: 1, d: 1, width: 100, price: 30 },
    jukebox: { name: 'Afterhours jukebox', cell: 8, w: 1, d: 1, width: 125, price: 100 },
    vending: { name: 'Soda machine', cell: 9, w: 1, d: 1, width: 115, price: 65 },
    portal: { name: 'Music portal', cell: 10, w: 1, d: 1, width: 140, price: 85 },
    dice: { name: 'Game dice', cell: 11, w: 1, d: 1, width: 85, price: 35 },
    notice: { name: 'Message board', cell: 12, w: 1, d: 1, width: 155, price: 30 },
    bowl: { name: 'Pet bowl', cell: 13, w: 1, d: 1, width: 65, price: 20 },
    gift: { name: 'Gift box', cell: 15, w: 1, d: 1, width: 85, price: 25 },
    loveseat: {"name": "Mint daybed sofa", "atlas": "loft", "crop": [20, 43, 305, 272], "collection": "loft", "category": "lounge", "w": 2, "d": 1, "width": 235, "price": 75, "description": "Two soft seats, cream cushions, and nowhere to rush.", "seats": [[0.66, 0.45], [0.34, 0.59]]},
    beanbag: {"name": "Coral beanbag", "atlas": "loft", "crop": [370, 40, 250, 245], "collection": "loft", "category": "lounge", "w": 1, "d": 1, "width": 144, "price": 35, "description": "Sink into a little pocket of comfort.", "seats": [[0.51, 0.48]]},
    boucle: {"name": "Cloud boucle chair", "atlas": "loft", "crop": [684, 40, 248, 260], "collection": "loft", "category": "lounge", "w": 1, "d": 1, "width": 145, "price": 55, "description": "A soft curved chair for long conversations.", "seats": [[0.53, 0.48]]},
    booth: {"name": "Cherry diner booth", "atlas": "loft", "crop": [980, 16, 255, 288], "collection": "diner", "category": "lounge", "w": 2, "d": 1, "width": 225, "price": 70, "description": "Two seats for coffee and late-night company.", "seats": [[0.70, 0.48], [0.34, 0.62]]},
    stool: {"name": "Teal counter stool", "atlas": "loft", "crop": [104, 325, 135, 283], "collection": "diner", "category": "lounge", "w": 1, "d": 1, "width": 76, "price": 25, "description": "Pull up a seat at your own cafe.", "seats": [[0.54, 0.35]]},
    tulip: {"name": "Tulip cafe table", "atlas": "loft", "crop": [351, 351, 258, 255], "collection": "diner", "category": "lounge", "w": 1, "d": 1, "width": 125, "price": 35, "description": "Cream enamel, polished chrome, and a place for two."},
    coffee: {"name": "Walnut glass table", "atlas": "loft", "crop": [640, 396, 301, 212], "collection": "loft", "category": "lounge", "w": 2, "d": 1, "width": 195, "price": 45, "description": "A glass-topped table with a trailing plant and a few favorite things."},
    desk: {"name": "Lamplight writing desk", "atlas": "loft", "crop": [980, 319, 254, 298], "collection": "loft", "category": "decor", "w": 2, "d": 1, "width": 190, "price": 60, "description": "For the studio you always wanted."},
    bookcase: {"name": "Collected stories shelf", "atlas": "loft", "crop": [59, 619, 197, 320], "collection": "loft", "category": "decor", "w": 1, "d": 1, "width": 117, "price": 50, "description": "Books, tiny treasures, and warm walnut."},
    bed: {"name": "Lavender quilt bed", "atlas": "loft", "crop": [326, 667, 342, 263], "collection": "loft", "category": "decor", "w": 2, "d": 2, "width": 225, "price": 90, "description": "Make your own quiet bedroom retreat. Decorative bed."},
    wardrobe: {"name": "Sage wardrobe", "atlas": "loft", "crop": [702, 619, 187, 316], "collection": "loft", "category": "interactive", "w": 1, "d": 1, "width": 112, "price": 55, "description": "Open the wardrobe to choose your look.", "use": "look"},
    aquarium: {"name": "Blue-hour aquarium", "atlas": "loft", "crop": [975, 624, 242, 307], "collection": "loft", "category": "decor", "w": 2, "d": 1, "width": 185, "price": 85, "description": "A little underwater world for your room."},
    fridge: {"name": "Mint retro fridge", "atlas": "loft", "crop": [76, 934, 173, 296], "collection": "diner", "category": "decor", "w": 1, "d": 1, "width": 103, "price": 45, "description": "The mint-green heart of a tiny diner."},
    espresso: {"name": "After-midnight coffee bar", "atlas": "loft", "crop": [359, 943, 269, 292], "collection": "diner", "category": "decor", "w": 2, "d": 1, "width": 195, "price": 65, "description": "Polished chrome and fresh-coffee atmosphere."},
    lava: {"name": "Violet lava lamp", "atlas": "loft", "crop": [765, 931, 95, 288], "collection": "loft", "category": "interactive", "w": 1, "d": 1, "width": 57, "price": 30, "description": "A slow violet glow. Click to switch it on or off.", "use": "light"},
    moon: {"name": "Neon moon sign", "atlas": "loft", "crop": [1012, 925, 200, 299], "collection": "loft", "category": "interactive", "w": 1, "d": 1, "width": 100, "price": 40, "description": "A pink crescent for your late-night corner.", "use": "light"},
    synth: {"name": "Analog dream synthesizer", "atlas": "culture", "crop": [42, 35, 273, 270], "collection": "studio", "category": "music", "w": 2, "d": 1, "width": 195, "price": 70, "description": "Open the beat studio and write your next track.", "use": "studio"},
    drums: {"name": "Teal session drums", "atlas": "culture", "crop": [361, 20, 273, 277], "collection": "studio", "category": "music", "w": 2, "d": 2, "width": 200, "price": 85, "description": "A full drum kit. Click to make a rhythm in the studio.", "use": "studio"},
    mic: {"name": "Golden-hour microphone", "atlas": "culture", "crop": [722, 17, 164, 270], "collection": "studio", "category": "music", "w": 1, "d": 1, "width": 80, "price": 35, "description": "Open the stage and choose a song to perform.", "use": "stage"},
    guitar: {"name": "Sunburst guitar stand", "atlas": "culture", "crop": [1045, 8, 136, 290], "collection": "studio", "category": "music", "w": 1, "d": 1, "width": 66, "price": 40, "description": "Your guitar is waiting. Open the studio to make a track.", "use": "studio"},
    boombox: {"name": "Mixtape boombox", "atlas": "culture", "crop": [42, 365, 261, 253], "collection": "studio", "category": "music", "w": 1, "d": 1, "width": 116, "price": 35, "description": "Play your room playlist or choose the next track.", "use": "playlist"},
    arcade: {"name": "Cosmic arcade cabinet", "atlas": "culture", "crop": [380, 307, 208, 324], "collection": "arcade", "category": "interactive", "w": 1, "d": 1, "width": 116, "price": 70, "description": "Open the arcade and play for credits.", "use": "arcade"},
    pinball: {"name": "Solar pinball cabinet", "atlas": "culture", "crop": [680, 306, 258, 325], "collection": "arcade", "category": "interactive", "w": 1, "d": 2, "width": 154, "price": 80, "description": "A collectible cabinet that opens the Afterhours arcade.", "use": "arcade"},
    hoops: {"name": "Backboard arcade", "atlas": "culture", "crop": [1001, 307, 223, 324], "collection": "arcade", "category": "interactive", "w": 1, "d": 2, "width": 155, "price": 80, "description": "Build a games corner. Opens the Afterhours arcade.", "use": "arcade"},
    monstera: {"name": "Monstera in cream", "atlas": "culture", "crop": [38, 634, 253, 291], "collection": "garden", "category": "decor", "w": 1, "d": 1, "width": 120, "price": 30, "description": "A big leafy friend in a ceramic pot.", "use": "water"},
    bonsai: {"name": "Little bonsai sanctuary", "atlas": "culture", "crop": [358, 639, 248, 301], "collection": "garden", "category": "decor", "w": 1, "d": 1, "width": 116, "price": 40, "description": "A miniature tree on a carved wood pedestal.", "use": "water"},
    cactus: {"name": "Desert cactus", "atlas": "culture", "crop": [718, 635, 147, 293], "collection": "garden", "category": "decor", "w": 1, "d": 1, "width": 83, "price": 25, "description": "A warm desert corner in terracotta.", "use": "water"},
    terrarium: {"name": "Glass garden terrarium", "atlas": "culture", "crop": [995, 665, 225, 268], "collection": "garden", "category": "decor", "w": 1, "d": 1, "width": 124, "price": 45, "description": "A tiny garden under glass.", "use": "water"},
    fountain: {"name": "Courtyard fountain", "atlas": "culture", "crop": [23, 940, 268, 287], "collection": "garden", "category": "decor", "w": 2, "d": 2, "width": 215, "price": 70, "description": "A stone centerpiece for your garden room."},
    pond: {"name": "Lily-pad pond", "atlas": "culture", "crop": [334, 961, 334, 256], "collection": "garden", "category": "decor", "w": 2, "d": 2, "width": 240, "price": 75, "description": "Water lilies and a little rocky waterfall."},
    lantern: {"name": "Evening garden lantern", "atlas": "culture", "crop": [726, 940, 113, 291], "collection": "garden", "category": "interactive", "w": 1, "d": 1, "width": 65, "price": 30, "description": "Warm amber light for your garden after dark.", "use": "light"},
    planter: {"name": "Wildflower window box", "atlas": "culture", "crop": [945, 958, 294, 266], "collection": "garden", "category": "decor", "w": 2, "d": 1, "width": 190, "price": 35, "description": "A cedar box full of lavender and wildflowers.", "use": "water"},
    // Collector sets (2026-10-20): crops are the opaque bounds of each piece on its transparent sheet.
    mooncradle: {"name":"Mooncradle sofa","atlas":"fantasyA","crop":[21,17,352,372],"collection":"fantasy","category":"lounge","w":2,"d":1,"width":230,"price":160,"description":"A crescent moon with room for two and a sky full of cushions.","seats":[[0.66,0.45],[0.34,0.59]]},
    auroraDecks: {"name":"Aurora decks","atlas":"fantasyA","crop":[422,12,366,366],"collection":"fantasy","category":"music","w":2,"d":1,"width":225,"price":150,"description":"Crystal turntables that catch the light on every drop.","use":"studio"},
    orbitarium: {"name":"Orbitarium","atlas":"fantasyA","crop":[848,12,315,376],"collection":"fantasy","category":"interactive","w":1,"d":1,"width":125,"price":110,"description":"A small solar system under glass. It glows when you need it.","use":"light"},
    koiFountain: {"name":"Astral koi fountain","atlas":"fantasyA","crop":[1233,14,319,375],"collection":"fantasy","category":"decor","w":2,"d":2,"width":220,"price":140,"description":"Three opal koi that never stop circling."},
    meteorJukebox: {"name":"Meteor jukebox","atlas":"fantasyA","crop":[1657,13,281,376],"collection":"fantasy","category":"music","w":1,"d":1,"width":118,"price":130,"description":"A fallen star that plays your records.","use":"playlist"},
    eclipseThrone: {"name":"Eclipse throne","atlas":"fantasyA","crop":[26,389,317,387],"collection":"fantasy","category":"lounge","w":1,"d":1,"width":140,"price":140,"description":"Velvet, gold, and a total eclipse behind your head.","seats":[[0.52,0.5]]},
    cloudSleeper: {"name":"Cloud sleeper","atlas":"fantasyA","crop":[389,408,401,358],"collection":"fantasy","category":"decor","w":2,"d":2,"width":240,"price":170,"description":"A galaxy duvet on a bed of cloud."},
    eventHorizon: {"name":"Event horizon table","atlas":"fantasyA","crop":[828,464,355,286],"collection":"fantasy","category":"lounge","w":2,"d":1,"width":210,"price":120,"description":"A coffee table with a spiral galaxy inside."},
    constellationChess: {"name":"Constellation chess table","atlas":"fantasyA","crop":[1232,421,384,359],"collection":"fantasy","category":"decor","w":1,"d":1,"width":150,"price":110,"description":"Crystal pieces on a board of stars."},
    prismGrand: {"name":"Prism grand","atlas":"fantasyA","crop":[1644,389,317,381],"collection":"fantasy","category":"music","w":2,"d":1,"width":200,"price":180,"description":"A grand piano cut from one enormous crystal.","use":"studio"},
    dragonBonsai: {"name":"Ember dragon bonsai","atlas":"fantasyB","crop":[53,24,359,363],"collection":"fantasy","category":"decor","w":1,"d":1,"width":140,"price":100,"description":"A bonsai with a sleeping dragon wound through its roots.","use":"water"},
    lunarGate: {"name":"Lunar gate","atlas":"fantasyB","crop":[475,8,338,379],"collection":"fantasy","category":"interactive","w":1,"d":1,"width":135,"price":150,"description":"A swirling moon gate. It glows when switched on.","use":"light"},
    cassetteSkyline: {"name":"Cassette skyline","atlas":"fantasyB","crop":[897,11,252,376],"collection":"fantasy","category":"decor","w":1,"d":1,"width":120,"price":110,"description":"A whole city skyline built from mixtapes."},
    midnightClaw: {"name":"Midnight claw","atlas":"fantasyB","crop":[1278,9,252,378],"collection":"fantasy","category":"interactive","w":1,"d":1,"width":115,"price":140,"description":"A claw machine full of moonlight. One more try.","use":"arcade"},
    glasswing: {"name":"Glasswing sanctuary","atlas":"fantasyB","crop":[1678,8,203,379],"collection":"fantasy","category":"interactive","w":1,"d":1,"width":105,"price":120,"description":"Butterflies in a lit glass dome.","use":"light"},
    sunkenAquarium: {"name":"Sunken palace aquarium","atlas":"fantasyB","crop":[27,409,496,366],"collection":"fantasy","category":"decor","w":2,"d":1,"width":230,"price":160,"description":"A long tank with a drowned golden palace."},
    vinylMonolith: {"name":"Vinyl monolith","atlas":"fantasyB","crop":[551,387,262,386],"collection":"fantasy","category":"music","w":1,"d":1,"width":118,"price":120,"description":"A black crystal that plays your records.","use":"playlist"},
    medusaLamp: {"name":"Medusa lamp","atlas":"fantasyB","crop":[940,387,168,388],"collection":"fantasy","category":"interactive","w":1,"d":1,"width":80,"price":90,"description":"A jellyfish of light drifting in its jar.","use":"light"},
    winterglassBench: {"name":"Winterglass bench","atlas":"fantasyB","crop":[1187,387,382,386],"collection":"fantasy","category":"lounge","w":2,"d":1,"width":225,"price":150,"description":"Two soft seats under an arch of frost.","seats":[[0.66,0.45],[0.34,0.59]]},
    coralDivider: {"name":"Coral cathedral divider","atlas":"fantasyB","crop":[1623,387,341,387],"collection":"fantasy","category":"decor","w":2,"d":1,"width":200,"price":120,"description":"A folding screen of coral and stained glass."},
    listeningThrone: {"name":"Listening throne","atlas":"denA","crop":[28,24,330,374],"collection":"den","category":"lounge","w":1,"d":1,"width":140,"price":120,"description":"Oxblood leather with speakers where your ears go.","seats":[[0.52,0.5]]},
    wallOfSound: {"name":"Wall of sound","atlas":"denA","crop":[395,12,291,393],"collection":"den","category":"music","w":2,"d":1,"width":190,"price":140,"description":"Brass horns and walnut cabinets. Turn it up.","use":"playlist"},
    clearDjBooth: {"name":"Clear-cut DJ booth","atlas":"denA","crop":[742,57,428,351],"collection":"den","category":"music","w":2,"d":1,"width":230,"price":150,"description":"See-through decks so the room can watch you mix.","use":"studio"},
    tapeCabinet: {"name":"Master tape cabinet","atlas":"denA","crop":[1215,49,347,359],"collection":"den","category":"music","w":2,"d":1,"width":200,"price":130,"description":"A reel-to-reel deck for the masters.","use":"playlist"},
    chromeMixtape: {"name":"Chrome mixtape","atlas":"denA","crop":[1596,40,373,368],"collection":"den","category":"music","w":1,"d":1,"width":120,"price":70,"description":"A chrome boombox. Batteries included.","use":"playlist"},
    cherrySofa: {"name":"Cherry channel sofa","atlas":"denA","crop":[17,437,469,320],"collection":"den","category":"lounge","w":2,"d":1,"width":235,"price":120,"description":"Channel-tufted cherry leather on chrome rails.","seats":[[0.66,0.45],[0.34,0.59]]},
    racingCockpit: {"name":"Apex racing cockpit","atlas":"denA","crop":[514,409,338,345],"collection":"den","category":"interactive","w":2,"d":1,"width":215,"price":170,"description":"Bucket seat, wheel, pedals, and one more lap.","use":"arcade"},
    glassPinball: {"name":"Glassworks pinball","atlas":"denA","crop":[866,408,270,367],"collection":"den","category":"interactive","w":1,"d":2,"width":155,"price":150,"description":"A glass-topped table full of molten light.","use":"arcade"},
    emeraldBilliards: {"name":"Emerald billiards","atlas":"denA","crop":[1159,408,436,358],"collection":"den","category":"decor","w":2,"d":2,"width":240,"price":160,"description":"Green baize, black lacquer, the break already racked."},
    flightCaseTable: {"name":"Touring flight-case table","atlas":"denA","crop":[1618,408,348,350],"collection":"den","category":"lounge","w":2,"d":1,"width":200,"price":80,"description":"A road case that came home from tour as a table."},
    walnutFoosball: {"name":"Walnut foosball","atlas":"denB","crop":[8,82,379,350],"collection":"den","category":"decor","w":2,"d":1,"width":210,"price":110,"description":"Walnut rails and two teams waiting for a match."},
    cocktailArcade: {"name":"Double-player cocktail arcade","atlas":"denB","crop":[399,83,385,346],"collection":"den","category":"interactive","w":2,"d":1,"width":210,"price":140,"description":"A sit-down cabinet for two players.","use":"arcade"},
    espressoBar: {"name":"Copper-lever espresso bar","atlas":"denB","crop":[789,7,356,425],"collection":"den","category":"decor","w":2,"d":1,"width":190,"price":120,"description":"Copper levers, navy cabinets, coffee all night."},
    oxbloodJukebox: {"name":"Oxblood jukebox","atlas":"denB","crop":[1177,6,269,426],"collection":"den","category":"music","w":1,"d":1,"width":116,"price":130,"description":"A classic jukebox that plays your records.","use":"playlist"},
    guitarVitrine: {"name":"Backstage guitar vitrine","atlas":"denB","crop":[1518,7,240,425],"collection":"den","category":"decor","w":1,"d":1,"width":115,"price":110,"description":"A signed guitar and a gold record behind glass."},
    sneakerArchive: {"name":"Sneaker archive","atlas":"denB","crop":[33,432,293,417],"collection":"den","category":"decor","w":1,"d":1,"width":120,"price":100,"description":"Six pairs on display, lights on."},
    glassBlockBar: {"name":"Emerald glass-block bar","atlas":"denB","crop":[359,440,432,408],"collection":"den","category":"decor","w":2,"d":1,"width":230,"price":140,"description":"A curved bar of green glass blocks and brass taps."},
    wheelClock: {"name":"Workshop wheel clock","atlas":"denB","crop":[816,432,241,426],"collection":"den","category":"decor","w":1,"d":1,"width":90,"price":80,"description":"A factory clock on a red cast-iron stand."},
    vinylCarousel: {"name":"Vinyl carousel","atlas":"denB","crop":[1091,432,298,407],"collection":"den","category":"music","w":1,"d":1,"width":120,"price":90,"description":"A rotating shelf for the whole record collection.","use":"playlist"},
    toolChest: {"name":"Racing-green tool chest","atlas":"denB","crop":[1418,432,348,417],"collection":"den","category":"decor","w":1,"d":1,"width":125,"price":70,"description":"A rolling chest with a vice on top."},
  };
  const mirrored = item => Boolean(item.rot % 2) !== Boolean(catalog[item.type].atlas);
  const footprint = item => {
    const c = catalog[item.type];
    return item.rot % 2 ? { w: c.d, d: c.w } : { w: c.w, d: c.d };
  };
  // Keep a seated person immediately in front of their seat, while allowing
  // furniture closer to the viewer to cover them naturally.
  const depth = item => { const {w,d}=footprint(item); return item.x+item.y+w+d-.1; };
  function actorDepth(actor, seatId, items) {
    const seat=seatId&&items.find(item=>item.placed!==false&&catalog[item.type]?.seats?.some((_,i)=>seatId===item.id+':'+i));
    return seat?depth(seat)+.01:actor.x+actor.y;
  }
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
  return { catalog, mirrored, footprint, depth, actorDepth, tiles, canPlace, normalize, starter };
});
