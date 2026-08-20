const DEFAULTS = {
    DISABLE_READ: false,
    DISABLE_TYPING: false,
    DISABLE_STORIES_SEEN: true
};

// Load settings from Chrome storage
chrome.storage.local.get(DEFAULTS, (result) => {
    Object.keys(DEFAULTS).forEach(key => {
        const checkbox = document.getElementById(key);
        checkbox.checked = result[key];

        // Listen for changes
        checkbox.addEventListener('change', async () => {
            const val = checkbox.checked;
            
            // 1. Save to extension storage
            chrome.storage.local.set({ [key]: val });
            
            // 2. Write directly to Facebook's localStorage using scripting API
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab && (tab.url.includes('facebook.com') || tab.url.includes('messenger.com'))) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (settingKey, settingVal) => {
                        // This runs inside Facebook's context
                        localStorage.setItem('unseen_' + settingKey, settingVal);
                    },
                    args: [key, val],
                    world: "MAIN"
                });
                
                // Reload tab to apply changes immediately
                chrome.tabs.reload(tab.id);
            }
        });
    });
});
