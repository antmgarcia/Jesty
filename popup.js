document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Initialize storage
  await JestyStorage.initializeStorage();

  // Load and display stats
  await loadStats();

  // Check support status for character expression
  await checkSupportStatus();
}

async function loadStats() {
  const roastCountEl = document.getElementById('roast-count');

  const stats = await JestyStorage.getUserStats();
  roastCountEl.textContent = stats.totalRoasts;
}

async function checkSupportStatus() {
  const character = document.getElementById('character');
  const statusText = document.getElementById('status-text');

  const stats = await JestyStorage.getUserStats();

  // Show happy face if they've used a lot
  if (stats.totalRoasts > 50) {
    character.innerHTML = '<svg><use href="#face-happy"/></svg>';
    statusText.textContent = 'Jesty is happy!';
    statusText.classList.add('happy');
  }
}
