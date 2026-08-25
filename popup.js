const SETTING = "DISABLE_STORIES_SEEN";
const DEFAULT_VALUE = true;
const checkbox = document.getElementById(SETTING);

async function getActiveSupportedTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  
  const url = tab?.url || "";
  // Check if the current tab is Facebook, Messenger, or Instagram
  const isSupported = url.includes("facebook.com") || 
                      url.includes("messenger.com") || 
                      url.includes("instagram.com");
                      
  if (!tab?.id || !isSupported) {
    return null;
  }
  return tab;
}

async function applySetting(value) {
  await chrome.storage.local.set({ [SETTING]: value });
  const tab = await getActiveSupportedTab();
  if (!tab) return;
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: (key, enabled) => {
        localStorage.setItem(`unseen_${key}`, String(enabled));
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: `unseen_${key}`,
            newValue: String(enabled)
          })
        );
      },
      args: [SETTING, value]
    });
  } catch (error) {
    console.debug("[Unseen] Could not update the active tab", error);
  }
}

chrome.storage.local.get({ [SETTING]: DEFAULT_VALUE }, (result) => {
  checkbox.checked = Boolean(result[SETTING]);
});

checkbox.addEventListener("change", () => {
  applySetting(checkbox.checked);
});