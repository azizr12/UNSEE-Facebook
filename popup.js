const DEFAULTS = {
    DISABLE_READ: false,
    DISABLE_TYPING: false,
    DISABLE_STORIES_SEEN: true
};

chrome.storage.local.get(DEFAULTS, (settings) => {
    Object.keys(DEFAULTS).forEach(key => {
        const checkbox = document.getElementById(key);
        checkbox.checked = settings[key];

        checkbox.addEventListener('change', () => {
            chrome.storage.local.set({ [key]: checkbox.checked });
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.url?.includes('facebook.com') || tabs[0]?.url?.includes('messenger.com')) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        });
    });
});
