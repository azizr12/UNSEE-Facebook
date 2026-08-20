const toggle = document.getElementById('enableToggle');
const statusText = document.getElementById('statusText');

// Load saved state (defaults to true if not set)
chrome.storage.sync.get(['storiesUnseenEnabled'], (result) => {
  const isEnabled = result.storiesUnseenEnabled !== false;
  toggle.checked = isEnabled;
  updateStatus(isEnabled);
});

// Save state when toggled
toggle.addEventListener('change', () => {
  const isEnabled = toggle.checked;
  chrome.storage.sync.set({ storiesUnseenEnabled: isEnabled }, () => {
    updateStatus(isEnabled);
  });
});

function updateStatus(isEnabled) {
  statusText.textContent = isEnabled ? 'Status: Active' : 'Status: Inactive';
  statusText.style.color = isEnabled ? '#31A24C' : '#65676B';
}