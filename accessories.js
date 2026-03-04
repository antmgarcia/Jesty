/**
 * Jesty Accessories System
 * Manages hat/glasses overlays on the character SVG.
 * Each accessory is a <symbol> element, rendered via <use> positioned per expression.
 * Also handles evolution stages (teen, adult, legend) with visual transforms.
 */
const JestyAccessories = (() => {
  /**
   * Accessory catalog
   * Each entry: { id, name, slot, tier, symbolId, unlockLevel? }
   */
  const CATALOG = [
    // Level unlocks (linear 2-20)
    { id: 'party-hat', name: 'Party Hat', slot: 'hat', tier: 'free', symbolId: 'acc-party-hat', unlockLevel: 2 },
    { id: 'sunglasses', name: 'Sunglasses', slot: 'glasses', tier: 'free', symbolId: 'acc-sunglasses', unlockLevel: 3 },
    { id: 'bandana', name: 'Bandana', slot: 'hat', tier: 'free', symbolId: 'acc-bandana', unlockLevel: 4 },
    { id: 'heart-shades', name: 'Heart Shades', slot: 'glasses', tier: 'free', symbolId: 'acc-heart-shades', unlockLevel: 5 },
    { id: 'beanie', name: 'Beanie', slot: 'hat', tier: 'premium', symbolId: 'acc-beanie', unlockLevel: 6 },
    { id: 'aviators', name: 'Aviators', slot: 'glasses', tier: 'premium', symbolId: 'acc-aviators', unlockLevel: 7 },
    { id: 'chef-hat', name: 'Chef Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-chef-hat', unlockLevel: 8 },
    { id: '3d-glasses', name: '3D Glasses', slot: 'glasses', tier: 'premium', symbolId: 'acc-3d-glasses', unlockLevel: 9 },
    { id: 'monocle', name: 'Monocle', slot: 'glasses', tier: 'premium', symbolId: 'acc-monocle', unlockLevel: 10 },
    { id: 'propeller-hat', name: 'Propeller Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-propeller-hat', unlockLevel: 11 },
    { id: 'star-glasses', name: 'Star Glasses', slot: 'glasses', tier: 'premium', symbolId: 'acc-star-glasses', unlockLevel: 12 },
    { id: 'crown', name: 'Crown', slot: 'hat', tier: 'premium', symbolId: 'acc-crown', unlockLevel: 13 },
    { id: 'bow-tie', name: 'Bow Tie', slot: 'glasses', tier: 'premium', symbolId: 'acc-bow-tie', unlockLevel: 14 },
    { id: 'detective-hat', name: 'Detective Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-detective-hat', unlockLevel: 15 },
    { id: 'headband', name: 'Headband', slot: 'hat', tier: 'premium', symbolId: 'acc-headband', unlockLevel: 16 },
    { id: 'viking-helmet', name: 'Viking Helmet', slot: 'hat', tier: 'premium', symbolId: 'acc-viking-helmet', unlockLevel: 17 },
    { id: 'top-hat', name: 'Top Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-top-hat', unlockLevel: 18 },
    { id: 'pirate-hat', name: 'Pirate Hat', slot: 'hat', tier: 'premium', symbolId: 'acc-pirate-hat', unlockLevel: 19 },
    { id: 'halo', name: 'Halo', slot: 'hat', tier: 'premium', symbolId: 'acc-halo', unlockLevel: 20 },
    // Pro-exclusive accessories
    { id: 'flame-crown', name: 'Flame Crown', slot: 'hat', tier: 'pro', symbolId: 'acc-flame-crown' },
    { id: 'neon-shades', name: 'Neon Shades', slot: 'glasses', tier: 'pro', symbolId: 'acc-neon-shades' },
    { id: 'wizard-hat', name: 'Wizard Hat', slot: 'hat', tier: 'pro', symbolId: 'acc-wizard-hat' }
  ];

  /**
   * Evolution stages
   * Each stage applies a scale and optional visual effects to the character.
   */
  const EVOLUTION_STAGES = {
    baby:   { minLevel: 1,  scale: 1.0,  label: 'Baby Blob', glow: false },
    teen:   { minLevel: 7,  scale: 1.06, label: 'Teen Blob', glow: false },
    adult:  { minLevel: 14, scale: 1.12, label: 'Adult Blob', glow: false },
    legend: { minLevel: 20, scale: 1.18, label: 'Legendary Blob', glow: true }
  };

  /**
   * Anchor points per expression per slot.
   * { x, y, rotate? } — position for the <use> element.
   * Values are in the SVG coordinate space (viewBox -15 -10 150 140).
   */
  const ANCHORS = {
    hat: {
      smug:         { x: 38, y: -2, rotate: 0 },
      suspicious:   { x: 38, y: -4, rotate: 6 },
      yikes:        { x: 40, y: -10, rotate: 0 },
      eyeroll:      { x: 36, y: 2, rotate: -3 },
      disappointed: { x: 40, y: 18, rotate: 0 },
      melting:      { x: 38, y: 0, rotate: 0 },
      dead:         { x: 38, y: 2, rotate: 8 },
      thinking:     { x: 38, y: -2, rotate: -5 },
      happy:        { x: 38, y: -8, rotate: 0 },
      impressed:    { x: 38, y: -4, rotate: 0 },
      manic:        { x: 38, y: -6, rotate: -4 },
      petty:        { x: 38, y: 0, rotate: 3 },
      chaotic:      { x: 40, y: -4, rotate: -8 },
      dramatic:     { x: 38, y: -2, rotate: 5 },
      tender:       { x: 38, y: -2, rotate: 0 }
    },
    glasses: {
      smug:         { x: 32, y: 42, rotate: 0 },
      suspicious:   { x: 32, y: 42, rotate: 3 },
      yikes:        { x: 34, y: 36, rotate: 0 },
      eyeroll:      { x: 32, y: 42, rotate: -2 },
      disappointed: { x: 34, y: 52, rotate: 0 },
      melting:      { x: 32, y: 42, rotate: 0 },
      dead:         { x: 32, y: 44, rotate: 5 },
      thinking:     { x: 34, y: 40, rotate: -3 },
      happy:        { x: 32, y: 40, rotate: 0 },
      impressed:    { x: 32, y: 42, rotate: 0 },
      manic:        { x: 32, y: 40, rotate: -3 },
      petty:        { x: 32, y: 42, rotate: 2 },
      chaotic:      { x: 34, y: 40, rotate: -8 },
      dramatic:     { x: 32, y: 42, rotate: 5 },
      tender:       { x: 32, y: 40, rotate: 0 }
    }
  };

  // Currently equipped accessories
  let equipped = { hat: null, glasses: null };

  // Current evolution stage
  let currentStage = 'baby';

  /**
   * Initialize: load equipped accessories and evolution stage from storage
   */
  async function init() {
    try {
      const data = await chrome.storage.local.get(['jesty_data']);
      if (data.jesty_data) {
        if (data.jesty_data.settings && data.jesty_data.settings.equipped_accessories) {
          equipped = { ...equipped, ...data.jesty_data.settings.equipped_accessories };
        }
        // Determine evolution stage from level
        const level = (data.jesty_data.progression && data.jesty_data.progression.level) || 1;
        currentStage = getStageForLevel(level);
      }
    } catch (e) { /* use defaults */ }
  }

  /**
   * Determine evolution stage from level
   */
  function getStageForLevel(level) {
    if (level >= 20) return 'legend';
    if (level >= 14) return 'adult';
    if (level >= 7) return 'teen';
    return 'baby';
  }

  /**
   * Get current evolution stage info
   */
  function getEvolutionStage() {
    return { stage: currentStage, ...EVOLUTION_STAGES[currentStage] };
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

    // Check tier access (pro/premium gate)
    if (typeof JestyPremium !== 'undefined') {
      if (acc.tier === 'pro' && !(await JestyPremium.isPro())) return false;
      if (acc.tier === 'premium' && !(await JestyPremium.isPremium())) return false;
    }

    // Free accessories are always unlocked (level is just for roadmap ordering)
    if (acc.tier === 'free') return true;

    // Check level requirement
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
   * Render accessories onto a target SVG container.
   * Also applies evolution stage visual effects.
   * Call this whenever the expression changes.
   * @param {string} expressionId - current expression (e.g. 'smug')
   * @param {SVGElement} svgContainer - the SVG element to render into
   */
  function renderAccessories(expressionId, svgContainer) {
    if (!svgContainer) return;

    // Remove existing accessory overlays, stage effects, and groups
    svgContainer.querySelectorAll('.jesty-accessory, .jesty-stage-effect, .jesty-acc-group').forEach(el => el.remove());

    // Apply evolution stage visual effects
    applyStageEffects(svgContainer);

    const hasAccs = Object.values(equipped).some(v => v);
    if (!hasAccs) return;

    // Wrap accessories in a group with evolution scaling so they match the character
    const stageInfo = EVOLUTION_STAGES[currentStage];
    const accGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    accGroup.classList.add('jesty-acc-group');

    if (stageInfo && currentStage !== 'baby') {
      const scale = stageInfo.scale;
      const offsetX = (1 - scale) * 60;
      const offsetY = (1 - scale) * 65;
      accGroup.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(${scale})`);
    }

    for (const slot of ['hat', 'glasses']) {
      const accId = equipped[slot];
      if (!accId) continue;

      const accessory = CATALOG.find(a => a.id === accId);
      if (!accessory) continue;

      const anchors = ANCHORS[slot];
      const anchor = anchors[expressionId] || anchors['smug'];

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
   * Apply evolution stage visual effects to the SVG
   */
  function applyStageEffects(svgContainer) {
    const stageInfo = EVOLUTION_STAGES[currentStage];
    if (!stageInfo || currentStage === 'baby') return;

    // Scale the character use element slightly
    const useEl = svgContainer.querySelector('use[href^="#face-"]');
    if (useEl) {
      const scale = stageInfo.scale;
      const offsetX = (1 - scale) * 60; // Center offset (character center ~60)
      const offsetY = (1 - scale) * 65;
      useEl.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(${scale})`);
    }

    // Legend glow effect
    if (stageInfo.glow) {
      // Add glow filter if not present
      let defs = svgContainer.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgContainer.prepend(defs);
      }
      if (!defs.querySelector('#legend-glow')) {
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'legend-glow');
        filter.setAttribute('x', '-20%');
        filter.setAttribute('y', '-20%');
        filter.setAttribute('width', '140%');
        filter.setAttribute('height', '140%');
        filter.innerHTML = `
          <feGaussianBlur stdDeviation="3" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        `;
        defs.appendChild(filter);
      }

      // Apply glow to character
      if (useEl) {
        useEl.setAttribute('filter', 'url(#legend-glow)');
      }
    }

    // Add stage indicator ring
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', '60');
    ring.setAttribute('cy', '60');
    ring.setAttribute('r', '68');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke-width', '1.5');
    ring.setAttribute('opacity', '0.3');
    ring.classList.add('jesty-stage-effect');

    if (currentStage === 'teen') {
      ring.setAttribute('stroke', '#60A5FA'); // Blue
    } else if (currentStage === 'adult') {
      ring.setAttribute('stroke', '#A78BFA'); // Purple
    } else if (currentStage === 'legend') {
      ring.setAttribute('stroke', '#FBBF24'); // Gold
      ring.setAttribute('opacity', '0.5');
      ring.setAttribute('stroke-width', '2');
    }

    svgContainer.insertBefore(ring, svgContainer.firstChild);
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

      const anchors = ANCHORS[slot];
      const anchor = anchors[expressionId] || anchors['smug'];

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
    if (!inner) return '';

    // Wrap in evolution scale group if needed
    const stageInfo = EVOLUTION_STAGES[currentStage];
    if (stageInfo && currentStage !== 'baby') {
      const scale = stageInfo.scale;
      const offsetX = (1 - scale) * 60;
      const offsetY = (1 - scale) * 65;
      return `<g transform="translate(${offsetX}, ${offsetY}) scale(${scale})">${inner}</g>`;
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
    renderAccessories, getAccessorySvgContent, getEvolutionStage, isUnlocked, getStageForLevel
  };
})();

if (typeof window !== 'undefined') {
  window.JestyAccessories = JestyAccessories;
}
