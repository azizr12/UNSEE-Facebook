// config-injector.js (Runs in default ISOLATED world)

// 1. Inject initial config on page load
chrome.storage.local.get(['unseen_config'], (result) => {
    injectConfig(result.unseen_config || { DISABLE_STORIES_SEEN: { enable: true } });
});

// 2. Listen for real-time changes from popup.html
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.unseen_config) {
        injectConfig(changes.unseen_config.newValue);
    }
});

function injectConfig(config) {
    const script = document.createElement('script');
    // Safely stringify and inject into the MAIN world
    script.textContent = `window.unseen_config = ${JSON.stringify(config)};`;
    document.documentElement.appendChild(script);
    script.remove();
}