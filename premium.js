/**
 * Jesty Premium Module
 * Manages premium state, feature gating, and tier checking.
 * Tiers: free | premium | pro
 * Display names: Suspect | Guilty | Sentenced
 */
const JestyPremium = (() => {
  /**
   * Feature → minimum tier mapping
   */
  const FEATURE_TIERS = {
    unlimited_roasts: 'premium',
    unlimited_chat: 'premium',
    focus_mode: 'premium',
    tasks: 'premium',
    tamagotchi: 'premium',
    wall_of_shame: 'premium',
    daily_report: 'premium',
    calendar: 'pro',
    calendar_roasts: 'pro',
    schedule_awareness: 'pro',
    pro_accessories: 'pro',
    evolution_stages: 'pro'
  };

  const TIER_RANK = { free: 0, premium: 1, pro: 2 };

  const TIER_DISPLAY_NAMES = { free: 'Suspect', premium: 'Guilty', pro: 'Sentenced' };

  function getTierDisplayName(tier) {
    return TIER_DISPLAY_NAMES[tier] || tier;
  }

  /**
   * Get current tier: free | premium | pro
   */
  async function getTier() {
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

  /**
   * Check if user has premium or higher
   */
  async function isPremium() {
    const tier = await getTier();
    return TIER_RANK[tier] >= TIER_RANK['premium'];
  }

  /**
   * Check if user has pro
   */
  async function isPro() {
    const tier = await getTier();
    return tier === 'pro';
  }

  /**
   * Check if user has access to a specific feature
   */
  async function checkFeature(featureName) {
    const requiredTier = FEATURE_TIERS[featureName];
    if (!requiredTier) return true; // Unknown features are free

    const userTier = await getTier();
    return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
  }

  /**
   * Activate premium (one-time purchase)
   */
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

  /**
   * Activate pro subscription
   */
  async function activateSubscription(tier, email, subscriptionId) {
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data) return false;

    jesty_data.settings.subscription_tier = tier;
    jesty_data.settings.subscription_status = 'active';
    jesty_data.settings.subscription_id = subscriptionId;
    if (email) jesty_data.settings.premium_email = email;

    // Pro includes premium
    if (tier === 'pro') {
      jesty_data.settings.is_premium = true;
      if (!jesty_data.settings.premium_since) {
        jesty_data.settings.premium_since = new Date().toISOString();
      }
    }

    await chrome.storage.local.set({ jesty_data });
    return true;
  }

  /**
   * Deactivate subscription (expire to premium or free)
   */
  async function deactivateSubscription() {
    const { jesty_data } = await chrome.storage.local.get(['jesty_data']);
    if (!jesty_data) return;

    jesty_data.settings.subscription_status = 'expired';
    jesty_data.settings.subscription_tier = null;
    // Keep is_premium if they had a one-time purchase
    await chrome.storage.local.set({ jesty_data });
  }

  return {
    getTier,
    getTierDisplayName,
    isPremium,
    isPro,
    checkFeature,
    activatePremium,
    activateSubscription,
    deactivateSubscription
  };
})();

if (typeof window !== 'undefined') {
  window.JestyPremium = JestyPremium;
}
