document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Initialize storage
  await JestyStorage.initializeStorage();

  const byokBtn = document.getElementById('byok-btn');
  const byokPanel = document.getElementById('byok-panel');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const cancelKeyBtn = document.getElementById('cancel-key-btn');
  const apiKeyInput = document.getElementById('api-key-input');

  // Load and display stats
  await loadStats();

  // Check if user has supported (for future use)
  await checkSupportStatus();

  // BYOK toggle
  byokBtn.addEventListener('click', () => {
    byokPanel.classList.toggle('hidden');
    if (!byokPanel.classList.contains('hidden')) {
      loadExistingKey();
    }
  });

  // Cancel BYOK
  cancelKeyBtn.addEventListener('click', () => {
    byokPanel.classList.add('hidden');
    apiKeyInput.value = '';
  });

  // Save API key
  saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (key && key.startsWith('sk-')) {
      await JestyStorage.setUserApiKey(key);
      byokPanel.classList.add('hidden');
      showFeedback('API key saved!');
    } else {
      showFeedback('Invalid key format', true);
    }
  });
}

async function loadStats() {
  const roastCountEl = document.getElementById('roast-count');

  const stats = await JestyStorage.getUserStats();
  roastCountEl.textContent = stats.totalRoasts;
}

async function loadExistingKey() {
  const apiKeyInput = document.getElementById('api-key-input');
  const existingKey = await JestyStorage.getUserApiKey();

  if (existingKey) {
    // Show masked version
    apiKeyInput.value = existingKey.substring(0, 7) + '...' + existingKey.slice(-4);
    apiKeyInput.placeholder = 'Key saved - enter new key to replace';
  }
}

async function checkSupportStatus() {
  const character = document.getElementById('character');
  const statusText = document.getElementById('status-text');

  const stats = await JestyStorage.getUserStats();

  // Show happy face if they've supported or used a lot
  if (stats.totalRoasts > 50) {
    character.innerHTML = '<svg><use href="#face-happy"/></svg>';
    statusText.textContent = 'Jesty is happy!';
    statusText.classList.add('happy');
  }
}

function showFeedback(message, isError = false) {
  const statusText = document.getElementById('status-text');
  const originalText = statusText.textContent;
  const originalClass = statusText.className;

  statusText.textContent = message;
  statusText.style.color = isError ? '#DC2626' : '#059669';

  setTimeout(() => {
    statusText.textContent = originalText;
    statusText.className = originalClass;
    statusText.style.color = '';
  }, 2000);
}
