/**
 * Jesty Accessories System
 * Manages hat/glasses overlays on the character SVG.
 * Each accessory is a <symbol> element, rendered via inline paths positioned per expression.
 */
const JestyAccessories = (() => {
  /**
   * Accessory catalog
   * Each entry: { id, name, slot, tier, symbolId, unlockLevel? }
   */
  const CATALOG = [
    // Always unlocked (free, no level requirement)
    { id: 'bucket-hat', name: 'Bucket Hat', slot: 'hat', tier: 'free', symbolId: 'acc-bucket-hat' },
    { id: 'sunglasses', name: 'Sunglasses', slot: 'glasses', tier: 'free', symbolId: 'acc-sunglasses' },
    { id: 'beanie', name: 'Beanie', slot: 'hat', tier: 'free', symbolId: 'acc-beanie' },
    { id: 'aviators', name: 'Aviators', slot: 'glasses', tier: 'free', symbolId: 'acc-aviators' },
    // Level unlocks (premium required)
    { id: 'bandana', name: 'Bandana', slot: 'hat', tier: 'premium', symbolId: 'acc-bandana', unlockLevel: 2 },
    { id: 'heart-shades', name: 'Heart Shades', slot: 'glasses', tier: 'premium', symbolId: 'acc-heart-shades', unlockLevel: 3 },
    { id: 'chef-hat', name: 'Chef Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-chef-hat', unlockLevel: 4 },
    { id: '3d-glasses', name: '3D Glasses', slot: 'glasses', tier: 'premium', symbolId: 'acc-3d-glasses', unlockLevel: 5 },
    { id: 'monocle', name: 'Monocle', slot: 'glasses', tier: 'premium', symbolId: 'acc-monocle', unlockLevel: 6 },
    { id: 'propeller-hat', name: 'Propeller Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-propeller-hat', unlockLevel: 7 },
    { id: 'star-glasses', name: 'Star Glasses', slot: 'glasses', tier: 'premium', symbolId: 'acc-star-glasses', unlockLevel: 8 },
    { id: 'crown', name: 'Crown', slot: 'hat', tier: 'premium', symbolId: 'acc-crown', unlockLevel: 9 },
    { id: 'bow-tie', name: 'Bow Tie', slot: 'glasses', tier: 'premium', symbolId: 'acc-bow-tie', unlockLevel: 10 },
    { id: 'detective-hat', name: 'Detective Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-detective-hat', unlockLevel: 11 },
    { id: 'headband', name: 'Headband', slot: 'hat', tier: 'premium', symbolId: 'acc-headband', unlockLevel: 12 },
    { id: 'viking-helmet', name: 'Viking Helmet', slot: 'hat', tier: 'premium', symbolId: 'acc-viking-helmet', unlockLevel: 13 },
    { id: 'top-hat', name: 'Top Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-top-hat', unlockLevel: 14 },
    { id: 'pirate-hat', name: 'Pirate Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-pirate-hat', unlockLevel: 15 },
    { id: 'halo', name: 'Halo', slot: 'hat', tier: 'premium', symbolId: 'acc-halo', unlockLevel: 16 },
    // Guilty-exclusive accessories (unlocked by paying Guilty tier)
    { id: 'party-hat', name: 'Party Hat', slot: 'hat', tier: 'guilty', symbolId: 'acc-party-hat' },
    { id: 'cowboy-hat', name: 'Cowboy Hat', slot: 'hat', tier: 'guilty', symbolId: 'acc-cowboy-hat' },
    { id: 'beret', name: 'Beret', slot: 'hat', tier: 'guilty', symbolId: 'acc-beret' },
    { id: 'round-glasses', name: 'Round Glasses', slot: 'glasses', tier: 'guilty', symbolId: 'acc-round-glasses' },
    { id: 'pixel-shades', name: 'Pixel Shades', slot: 'glasses', tier: 'guilty', symbolId: 'acc-pixel-shades' },
    // Pro-exclusive accessories
    { id: 'flame-crown', name: 'Flame Crown', slot: 'hat', tier: 'pro', symbolId: 'acc-flame-crown' },
    { id: 'neon-shades', name: 'Neon Shades', slot: 'glasses', tier: 'pro', symbolId: 'acc-neon-shades' },
    { id: 'wizard-hat', name: 'Wizard Hat', slot: 'hat', tier: 'pro', symbolId: 'acc-wizard-hat' }
  ];

  /**
   * Anchor points per expression per slot.
   * { x, y, rotate? } — position in the SVG coordinate space (viewBox -15 -10 150 140).
   */
  const ANCHORS = {
    hat: {
      smug:         { x: 36, y: -2, rotate: 0 },
      suspicious:   { x: 36, y: -6, rotate: 6 },
      yikes:        { x: 38, y: -10, rotate: 0 },
      eyeroll:      { x: 34, y: 0, rotate: -3 },
      disappointed: { x: 38, y: 18, rotate: 0 },
      melting:      { x: 36, y: -2, rotate: 0 },
      dead:         { x: 36, y: 0, rotate: 8 },
      thinking:     { x: 34, y: -4, rotate: -5 },
      happy:        { x: 36, y: -8, rotate: 0 },
      impressed:    { x: 36, y: -4, rotate: 0 },
      manic:        { x: 36, y: -6, rotate: -4 },
      petty:        { x: 36, y: 0, rotate: 3 },
      chaotic:      { x: 38, y: -4, rotate: -8 },
      dramatic:     { x: 36, y: -2, rotate: 5 },
      tender:       { x: 36, y: -2, rotate: 0 }
    },
    glasses: {
      smug:         { x: 32, y: 42, rotate: 0 },
      suspicious:   { x: 32, y: 40, rotate: 3 },
      yikes:        { x: 34, y: 34, rotate: 0 },
      eyeroll:      { x: 32, y: 44, rotate: -2 },
      disappointed: { x: 34, y: 54, rotate: 0 },
      melting:      { x: 32, y: 42, rotate: 0 },
      dead:         { x: 32, y: 44, rotate: 5 },
      thinking:     { x: 32, y: 40, rotate: -3 },
      happy:        { x: 32, y: 38, rotate: 0 },
      impressed:    { x: 32, y: 40, rotate: 0 },
      manic:        { x: 32, y: 38, rotate: -3 },
      petty:        { x: 32, y: 42, rotate: 2 },
      chaotic:      { x: 34, y: 40, rotate: -8 },
      dramatic:     { x: 32, y: 42, rotate: 5 },
      tender:       { x: 32, y: 40, rotate: 0 }
    }
  };

  /**
   * Per-accessory anchor overrides.
   * Accessories that sit differently (e.g. bandana wraps around the head)
   * define full anchor maps here instead of using the shared slot anchors.
   */
  const ACC_ANCHORS = {
    'bandana': {
      smug:         { x: 35, y: 6, rotate: -3 },
      suspicious:   { x: 35, y: 4, rotate: 8 },
      yikes:        { x: 37, y: -2, rotate: -2 },
      eyeroll:      { x: 33, y: 10, rotate: -5 },
      disappointed: { x: 37, y: 26, rotate: 2 },
      melting:      { x: 35, y: 8, rotate: -2 },
      dead:         { x: 35, y: 10, rotate: 10 },
      thinking:     { x: 30, y: 6, rotate: -7 },
      happy:        { x: 35, y: 0, rotate: -2 },
      impressed:    { x: 35, y: 4, rotate: -3 },
      manic:        { x: 35, y: 2, rotate: -6 },
      petty:        { x: 35, y: 8, rotate: 5 },
      chaotic:      { x: 37, y: 4, rotate: -10 },
      dramatic:     { x: 35, y: 6, rotate: 7 },
      tender:       { x: 35, y: 6, rotate: -2 }
    },
    'beret': {
      smug:         { x: 34, y: 2, rotate: -8 },
      suspicious:   { x: 34, y: 0, rotate: -2 },
      yikes:        { x: 36, y: -6, rotate: -8 },
      eyeroll:      { x: 32, y: 6, rotate: -11 },
      disappointed: { x: 36, y: 22, rotate: -8 },
      melting:      { x: 34, y: 4, rotate: -8 },
      dead:         { x: 34, y: 6, rotate: 0 },
      thinking:     { x: 30, y: 2, rotate: -13 },
      happy:        { x: 34, y: -4, rotate: -8 },
      impressed:    { x: 34, y: 0, rotate: -8 },
      manic:        { x: 34, y: -2, rotate: -12 },
      petty:        { x: 34, y: 4, rotate: -5 },
      chaotic:      { x: 36, y: 0, rotate: -16 },
      dramatic:     { x: 34, y: 2, rotate: -3 },
      tender:       { x: 34, y: 2, rotate: -8 }
    },
    'headband': {
      smug:         { x: 34, y: 12, rotate: 0 },
      suspicious:   { x: 34, y: 10, rotate: 6 },
      yikes:        { x: 36, y: 4, rotate: 0 },
      eyeroll:      { x: 32, y: 16, rotate: -3 },
      disappointed: { x: 36, y: 30, rotate: 0 },
      melting:      { x: 34, y: 14, rotate: 0 },
      dead:         { x: 34, y: 16, rotate: 8 },
      thinking:     { x: 34, y: 12, rotate: -5 },
      happy:        { x: 34, y: 6, rotate: 0 },
      impressed:    { x: 34, y: 10, rotate: 0 },
      manic:        { x: 34, y: 8, rotate: -4 },
      petty:        { x: 34, y: 14, rotate: 3 },
      chaotic:      { x: 36, y: 10, rotate: -8 },
      dramatic:     { x: 34, y: 12, rotate: 5 },
      tender:       { x: 34, y: 12, rotate: 0 }
    }
  };

  // Currently equipped accessories
  let equipped = { hat: null, glasses: null };

  // Default accessories for new users (auto-onboarding)
  const DEFAULT_HATS = ['bucket-hat', 'beanie'];
  const DEFAULTS_GLASSES = 'aviators';

  /**
   * Initialize: load equipped accessories from storage.
   * New users get default accessories so the character looks dressed from the start.
   */
  async function init() {
    try {
      const data = await chrome.storage.local.get(['jesty_data']);
      const seeded = await chrome.storage.local.get(['jestyAccessoriesSeeded']);
      if (data.jesty_data && data.jesty_data.settings && data.jesty_data.settings.equipped_accessories) {
        equipped = { ...equipped, ...data.jesty_data.settings.equipped_accessories };
      } else if (!seeded.jestyAccessoriesSeeded) {
        // First launch: random hat + aviators, persist
        const hat = DEFAULT_HATS[Math.floor(Math.random() * DEFAULT_HATS.length)];
        equipped = { hat, glasses: DEFAULTS_GLASSES };
        await saveEquipped();
        await chrome.storage.local.set({ jestyAccessoriesSeeded: true });
      }
    } catch (e) { /* use defaults */ }
  }

  /**
   * Get all accessories, optionally filtered by slot or tier
   */
  function getCatalog(filter) {
    if (!filter) return [...CATALOG];
    return CATALOG.filter(a => {
      if (filter.slot && a.slot !== filter.slot) return false;
      if (filter.tier && a.tier !== filter.tier) return false;
      return true;
    });
  }

  /**
   * Check if an accessory is unlocked for the current user
   */
  async function isUnlocked(accessoryId) {
    const acc = CATALOG.find(a => a.id === accessoryId);
    if (!acc) return false;

    // Pro-exclusive accessories require pro tier
    if (acc.tier === 'pro') {
      if (typeof JestyPremium === 'undefined') return false;
      if (!(await JestyPremium.isPro())) return false;
      return true;
    }

    // Guilty-exclusive accessories require premium (guilty) tier or higher
    if (acc.tier === 'guilty') {
      if (typeof JestyPremium === 'undefined') return false;
      if (!(await JestyPremium.isPremium())) return false;
      return true;
    }

    // Free accessories are always unlocked
    if (acc.tier === 'free') return true;

    // Premium accessories unlock by level (available to all tiers)
    if (acc.unlockLevel) {
      try {
        const data = await chrome.storage.local.get(['jesty_data']);
        const level = (data.jesty_data && data.jesty_data.progression && data.jesty_data.progression.level) || 1;
        if (level < acc.unlockLevel) return false;
      } catch { return false; }
    }

    return true;
  }

  /**
   * Equip an accessory by id
   */
  async function equipAccessory(slot, accessoryId) {
    const accessory = CATALOG.find(a => a.id === accessoryId && a.slot === slot);
    if (!accessory) return false;

    if (!(await isUnlocked(accessoryId))) return false;

    equipped[slot] = accessoryId;
    await saveEquipped();
    return true;
  }

  /**
   * Unequip an accessory slot
   */
  async function unequipAccessory(slot) {
    equipped[slot] = null;
    await saveEquipped();
  }

  /**
   * Get currently equipped accessories
   */
  function getEquipped() {
    return { ...equipped };
  }

  /**
   * Inline face content: add raw symbol paths alongside <use> and hide <use>.
   * This ensures face and accessories share the same coordinate system
   * (fixes positioning mismatch caused by <use>/<symbol> viewport indirection).
   * The <use> element is kept hidden so the animator can still update its href.
   */
  function inlineFaceContent(expressionId, svgContainer) {
    const useEl = svgContainer.querySelector('use[href^="#face-"]');
    if (!useEl) return null;

    const faceSymbol = document.getElementById(`face-${expressionId}`);
    if (!faceSymbol) return null;

    // Hide <use> but keep it in DOM for the animator to update
    useEl.setAttribute('display', 'none');

    const suffix = Math.random().toString(36).slice(2, 6);
    let content = faceSymbol.innerHTML;
    // Make clipPath IDs unique to avoid collision with the shared symbol defs
    content = content.replace(/id="clip-([^"]+)"/g, `id="clip-$1-${suffix}"`);
    content = content.replace(/url\(#clip-([^)]+)\)/g, `url(#clip-$1-${suffix})`);

    const faceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    faceGroup.classList.add('jesty-face-inline');
    faceGroup.innerHTML = content;
    // Insert after <use> so it renders in the same position
    useEl.after(faceGroup);
    return suffix;
  }

  /**
   * Render accessories onto a target SVG container.
   * Call this whenever the expression changes.
   * @param {string} expressionId - current expression (e.g. 'smug')
   * @param {SVGElement} svgContainer - the SVG element to render into
   */
  function renderAccessories(expressionId, svgContainer) {
    if (!svgContainer) return;

    // Detect layered SVG (GSAP animated character)
    const layerAccGroup = svgContainer.querySelector('#layer-accessories');
    const isLayeredSvg = !!layerAccGroup;

    if (isLayeredSvg) {
      // Layered mode: render directly into #layer-accessories
      layerAccGroup.innerHTML = '';

      const hasAccs = Object.values(equipped).some(v => v);
      if (!hasAccs) return;

      for (const slot of ['hat', 'glasses']) {
        const accId = equipped[slot];
        if (!accId) continue;

        const accessory = CATALOG.find(a => a.id === accId);
        if (!accessory) continue;

        const accAnchors = ACC_ANCHORS[accId] || ANCHORS[slot];
        const anchor = accAnchors[expressionId] || accAnchors['smug'];

        const symbol = document.getElementById(accessory.symbolId);
        if (!symbol) continue;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('jesty-accessory');

        let transform = `translate(${anchor.x}, ${anchor.y})`;
        if (anchor.rotate) {
          const vb = symbol.getAttribute('viewBox');
          const [, , symW, symH] = vb ? vb.split(/\s+/).map(Number) : [0, 0, 44, 30];
          transform += ` rotate(${anchor.rotate}, ${symW / 2}, ${symH / 2})`;
        }
        g.setAttribute('transform', transform);
        g.innerHTML = symbol.innerHTML;
        layerAccGroup.appendChild(g);
      }
      return;
    }

    // Static mode (newtab, games, etc): original inline approach
    // Remove existing accessory overlays, groups, and inlined faces
    svgContainer.querySelectorAll('.jesty-accessory, .jesty-acc-group, .jesty-face-inline').forEach(el => el.remove());

    // Inline the face: replace <use> with raw paths so face + accessories
    // share the same coordinate system (fixes positioning mismatch)
    inlineFaceContent(expressionId, svgContainer);

    const hasAccs = Object.values(equipped).some(v => v);
    if (!hasAccs) return;

    const accGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    accGroup.classList.add('jesty-acc-group');

    for (const slot of ['hat', 'glasses']) {
      const accId = equipped[slot];
      if (!accId) continue;

      const accessory = CATALOG.find(a => a.id === accId);
      if (!accessory) continue;

      const accAnchors = ACC_ANCHORS[accId] || ANCHORS[slot];
      const anchor = accAnchors[expressionId] || accAnchors['smug'];

      const symbol = document.getElementById(accessory.symbolId);
      if (!symbol) continue;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('jesty-accessory');

      let transform = `translate(${anchor.x}, ${anchor.y})`;
      if (anchor.rotate) {
        const vb = symbol.getAttribute('viewBox');
        const [, , symW, symH] = vb ? vb.split(/\s+/).map(Number) : [0, 0, 44, 30];
        transform += ` rotate(${anchor.rotate}, ${symW / 2}, ${symH / 2})`;
      }
      g.setAttribute('transform', transform);
      g.innerHTML = symbol.innerHTML;
      accGroup.appendChild(g);
    }

    svgContainer.appendChild(accGroup);
  }

  /**
   * Get raw SVG markup for equipped accessories at a given expression.
   * Used for share image generation (canvas rendering).
   * @param {string} expressionId
   * @returns {string} SVG markup string
   */
  function getAccessorySvgContent(expressionId) {
    let inner = '';
    for (const slot of ['hat', 'glasses']) {
      const accId = equipped[slot];
      if (!accId) continue;

      const accessory = CATALOG.find(a => a.id === accId);
      if (!accessory) continue;

      const accAnchors = ACC_ANCHORS[accId] || ANCHORS[slot];
      const anchor = accAnchors[expressionId] || accAnchors['smug'];

      const symbol = document.getElementById(accessory.symbolId);
      if (!symbol) continue;

      let transform = `translate(${anchor.x}, ${anchor.y})`;
      if (anchor.rotate) {
        const vb = symbol.getAttribute('viewBox');
        const [, , symW, symH] = vb ? vb.split(/\s+/).map(Number) : [0, 0, 44, 30];
        transform += ` rotate(${anchor.rotate}, ${symW / 2}, ${symH / 2})`;
      }
      inner += `<g transform="${transform}">${symbol.innerHTML}</g>`;
    }
    return inner;
  }

  /**
   * Unequip all accessories
   */
  async function unequipAll() {
    equipped = { hat: null, glasses: null };
    await saveEquipped();
  }

  /**
   * Save equipped state to storage
   */
  async function saveEquipped() {
    try {
      const result = await chrome.storage.local.get(['jesty_data']);
      if (result.jesty_data) {
        if (!result.jesty_data.settings) result.jesty_data.settings = {};
        result.jesty_data.settings.equipped_accessories = { ...equipped };
        await chrome.storage.local.set({ jesty_data: result.jesty_data });
      }
    } catch (e) { /* non-critical */ }

    // Notify other surfaces
    await chrome.storage.local.set({ jestyAccessoriesChanged: Date.now() });
  }

  return {
    init, getCatalog, equipAccessory, unequipAccessory, unequipAll, getEquipped,
    renderAccessories, getAccessorySvgContent, isUnlocked, inlineFaceContent
  };
})();

if (typeof window !== 'undefined') {
  window.JestyAccessories = JestyAccessories;
}
