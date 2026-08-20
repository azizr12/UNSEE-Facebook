const DEFAULTS = {
    DISABLE_READ: false,
    DISABLE_TYPING: false,
    DISABLE_STORIES_SEEN: true
};

// Load settings
Object.keys(DEFAULTS).forEach(key => {
    const checkbox = document.getElementById(key);
    const val = localStorage.getItem('unseen_' + key);
    checkbox.checked = val !== null ? val === 'true' : DEFAULTS[key];

    // Listen for changes
    checkbox.addEventListener('change', () => {
        localStorage.setItem('unseen_' + key, checkbox.checked);
        // Reload active tab to apply changes immediately
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.url?.includes('facebook.com') || tabs[0]?.url?.includes('messenger.com')) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
    });
});
