const CONFIG = {
  API_URL: 'https://jesty-api.hey-9f5.workers.dev',
  API_KEY: 'jsk_7f2a9c4e1b8d3f6a5e0c9d2b4a7f8e1c',
  DEV_MODE: !('update_url' in chrome.runtime.getManifest())
};

// Locale-aware pricing
const EU_LOCALES = ['pt','es','fr','de','it','nl','be','at','fi','ie','gr','lu','mt','cy','sk','si','ee','lv','lt','hr','bg','ro','cz','dk','se','pl','hu'];
const _lang = (navigator.language || '').toLowerCase();
const _isEU = EU_LOCALES.some(c => _lang.endsWith('-' + c) || _lang === c);
const PRICE = {
  premium: _isEU ? '€5' : '$5',
  premiumFull: _isEU ? '€5 once' : '$5 once',
  pro: _isEU ? '€5/mo' : '$5/mo',
  symbol: _isEU ? '€' : '$',
  amount: 5
};
