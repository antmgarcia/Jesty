/**
 * Jesty Premium Module
 * Manages premium state, feature gating, and tier checking.
 * Tiers: free | premium | pro
 * Display names: Suspect | Guilty | Sentenced
 *
 * DEV_MODE tier switching (console commands):
 *   JestyPremium.dev('free')      → switch to Suspect
 *   JestyPremium.dev('premium')   → switch to Guilty
 *   JestyPremium.dev('pro')       → switch to Sentenced
 *   JestyPremium.dev(null)        → clear override, use real tier
 *   JestyPremium.dev()            → show current override
 */
const JestyPremium = (() => {
  const FEATURE_TIERS = {
    unlimited_roasts: 'premium',
    unlimited_chat: 'premium',
    tasks: 'premium',
    tamagotchi: 'premium',
    games_full: 'premium',
    pro_accessories: 'pro'
  };

  const TIER_RANK = { free: 0, premium: 1, pro: 2 };

  const TIER_DISPLAY_NAMES = { free: 'Suspect', premium: 'Guilty', pro: 'Sentenced' };

  function _isDevMode() {
    return typeof CONFIG !== 'undefined' && CONFIG.DEV_MODE === true;
  }

  function getTierDisplayName(tier) {
    return TIER_DISPLAY_NAMES[tier] || tier;
  }

  /**
   * Get current tier: free | premium | pro
   */
  async function getTier() {
    // Check storage-persisted dev override (DEV_MODE only)
    if (_isDevMode()) {
      try {
        const { jestyDevTier } = await chrome.storage.local.get(['jestyDevTier']);
        if (jestyDevTier && TIER_RANK[jestyDevTier] !== undefined) return jestyDevTier;
      } catch {}
    }

    try {
      const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
      if (!jesty_data || !jesty_data.settings) return 'free';

      // Check subscription first (pro overrides premium)
      if (jesty_data.settings.subscription_tier === 'pro' &&
          jesty_data.settings.subscription_status === 'active') {
        return 'pro';
      }

      if (jesty_data.settings.is_premium) return 'premium';
      return 'free';
    } catch {
      return 'free';
    }
  }

  async function isPremium() {
    const tier = await getTier();
    return TIER_RANK[tier] >= TIER_RANK['premium'];
  }

  async function isPro() {
    const tier = await getTier();
    return tier === 'pro';
  }

  async function checkFeature(featureName) {
    const requiredTier = FEATURE_TIERS[featureName];
    if (!requiredTier) return true;

    const userTier = await getTier();
    return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
  }

  async function activatePremium(email, receiptId) {
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data) return false;

    jesty_data.settings.is_premium = true;
    jesty_data.settings.premium_since = new Date().toISOString();
    if (email) jesty_data.settings.premium_email = email;
    if (receiptId) jesty_data.settings.premium_receipt_id = receiptId;

    await chrome.storage.local.set({ jesty_data });
    return true;
  }

  async function activateSubscription(tier, email, subscriptionId) {
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data) return false;

    jesty_data.settings.subscription_tier = tier;
    jesty_data.settings.subscription_status = 'active';
    jesty_data.settings.subscription_id = subscriptionId;
    if (email) jesty_data.settings.premium_email = email;

    if (tier === 'pro') {
      jesty_data.settings.is_premium = true;
      if (!jesty_data.settings.premium_since) {
        jesty_data.settings.premium_since = new Date().toISOString();
      }
    }

    await chrome.storage.local.set({ jesty_data });
    return true;
  }

  async function deactivateSubscription() {
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data) return;

    jesty_data.settings.subscription_status = 'expired';
    jesty_data.settings.subscription_tier = null;
    await chrome.storage.local.set({ jesty_data });
  }

  /**
   * Dev-only tier switching. Persists to storage so it works across all surfaces.
   * Pass a tier string to set, null to clear, or no args to check current.
   */
  async function dev(tier) {
    if (!_isDevMode()) {
      console.warn('JestyPremium.dev() is only available when CONFIG.DEV_MODE = true');
      return;
    }

    // No args → show current state
    if (tier === undefined) {
      const { jestyDevTier } = await chrome.storage.local.get(['jestyDevTier']);
      const real = await _getRealTier();
      if (jestyDevTier) {
        console.log(`%c[DEV] Override: ${jestyDevTier} (${getTierDisplayName(jestyDevTier)})%c  |  Real tier: ${real} (${getTierDisplayName(real)})`,
          'color: #EAB308; font-weight: bold', 'color: gray');
      } else {
        console.log(`%c[DEV] No override active  |  Real tier: ${real} (${getTierDisplayName(real)})`, 'color: gray');
      }
      return;
    }

    // null → clear
    if (tier === null) {
      await chrome.storage.local.remove(['jestyDevTier']);
      const real = await _getRealTier();
      console.log(`%c[DEV] Override cleared → using real tier: ${real} (${getTierDisplayName(real)})`, 'color: #34D399; font-weight: bold');
      console.log('%cReload the page to apply.', 'color: gray; font-style: italic');
      return;
    }

    // Validate
    if (!TIER_RANK.hasOwnProperty(tier)) {
      console.error(`Invalid tier "${tier}". Use: 'free', 'premium', or 'pro'`);
      return;
    }

    // Reset tier-specific state so it feels like a fresh user at this tier
    await _resetTierState();

    await chrome.storage.local.set({ jestyDevTier: tier });
    console.log(`%c[DEV] Tier set to: ${tier} (${getTierDisplayName(tier)})`, 'color: #EAB308; font-weight: bold');
    console.log('%cState reset to fresh user. Reload the page to apply.', 'color: gray; font-style: italic');
  }

  /**
   * Wipe all tier-sensitive state so each switch simulates a first-time user.
   */
  async function _resetTierState() {
    // Remove standalone storage keys
    await chrome.storage.local.remove([
      'jestyTaskSeeded',
      'currentTask',
      'taskStartTabCount',
      'pendingXPGain',
      'jestyFunZone',
      'focusSession',
      'focusBlurEnabled',
      'focusAudioTrack',
      'focusAudioVolume',
      'lastBriefingDate'
    ]);

    // Reset tier-sensitive fields inside jesty_data
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (jesty_data) {
      jesty_data.user_tasks = [];
      jesty_data.progression = { level: 1, xp: 0, xp_to_next: 100, total_xp: 0 };
      jesty_data.records = { wall_of_shame: [], hall_of_fame: [] };
      jesty_data.daily_reports = [];
      jesty_data.focus_sessions = [];
      // Reset daily cap so roast limits test fresh
      if (jesty_data.settings) {
        jesty_data.settings.roasts_today = 0;
        jesty_data.settings.roast_cap_date = null;
      }
      await chrome.storage.local.set({ jesty_data });
    }
  }

  /** Get real tier ignoring dev override (for dev() status display) */
  async function _getRealTier() {
    try {
      const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
      if (!jesty_data || !jesty_data.settings) return 'free';
      if (jesty_data.settings.subscription_tier === 'pro' &&
          jesty_data.settings.subscription_status === 'active') return 'pro';
      if (jesty_data.settings.is_premium) return 'premium';
      return 'free';
    } catch { return 'free'; }
  }

  return {
    getTier,
    getTierDisplayName,
    isPremium,
    isPro,
    checkFeature,
    activatePremium,
    activateSubscription,
    deactivateSubscription,
    dev
  };
})();

if (typeof window !== 'undefined') {
  window.JestyPremium = JestyPremium;
}
