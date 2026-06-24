(function registerMapSpriteCatalog(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.world = app.world || {};

  const SPRITE_SOURCES = Object.freeze({
    grass: 'assets/grass.png',
    sand: 'assets/sand.png',
    dirt: 'assets/dirt.png',
    stone: 'assets/stone.png',
    cobblestone: 'assets/cobblestone.png',
    wall: 'assets/wall.png',
    wallDark: 'assets/wall_dark.png',
    unit: 'assets/unit_sprites.svg',
    transitions: Object.freeze({
      'grass-dirt': 'assets/grass-dirt.png',
      'grass-sand': 'assets/grass-sand.png',
      'dirt-grass': 'assets/dirt-grass.png',
      'dirt-sand': 'assets/dirt-sand.png',
      'sand-grass': 'assets/sand-grass.png',
      'sand-dirt': 'assets/sand-dirt.png',
      'stone-grass': 'assets/stone-grass.png',
      'stone-dirt': 'assets/stone-dirt.png',
      'stone-sand': 'assets/stone-sand.png'
    })
  });

  function createImage(ImageCtor, src) {
    const image = new ImageCtor();
    image.src = src;
    return image;
  }

  function createTileSprites({ ImageCtor = root.Image } = {}) {
    if (typeof ImageCtor !== 'function') throw new Error('Map sprite catalog requires an Image constructor');
    const transitions = {};
    for (const [key, src] of Object.entries(SPRITE_SOURCES.transitions)) {
      transitions[key] = createImage(ImageCtor, src);
    }
    return {
      grass: createImage(ImageCtor, SPRITE_SOURCES.grass),
      dirt: createImage(ImageCtor, SPRITE_SOURCES.dirt),
      sand: createImage(ImageCtor, SPRITE_SOURCES.sand),
      stone: createImage(ImageCtor, SPRITE_SOURCES.stone),
      transitions,
      cobblestone: createImage(ImageCtor, SPRITE_SOURCES.cobblestone),
      wall: createImage(ImageCtor, SPRITE_SOURCES.wall),
      wallDark: createImage(ImageCtor, SPRITE_SOURCES.wallDark),
      unit: createImage(ImageCtor, SPRITE_SOURCES.unit)
    };
  }

  app.world.mapSprites = Object.freeze({
    SPRITE_SOURCES,
    createTileSprites
  });
})(globalThis);
