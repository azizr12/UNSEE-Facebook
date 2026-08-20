const keys = ['DISABLE_READ', 'DISABLE_TYPING', 'DISABLE_STORIES_SEEN'];

// Load settings
keys.forEach(key => {
    const checkbox = document.getElementById(key);
    // Default to true if not set
    const val = localStorage.getItem('unseen_' + key);
    checkbox.checked = val !== null ? val === 'true' : true; 
    
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
