const SETTING = "DISABLE_STORIES_SEEN";
const DEFAULT_VALUE = true;

const checkbox = document.getElementById(SETTING);

async function getActiveFacebookTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id || !/^https:\/\/(www\.|web\.)?(facebook|messenger)\.com\//.test(tab.url || "")) {
    return null;
  }

  return tab;
}

async function applySetting(value) {
  await chrome.storage.local.set({ [SETTING]: value });

  const tab = await getActiveFacebookTab();
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
