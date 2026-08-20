(function() {
    if (window.__stories_unseen_injected) return;
    window.__stories_unseen_injected = true;

    // State variable controlled by the popup
    let isEnabled = true;

    // Load initial state
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['storiesUnseenEnabled'], (result) => {
            isEnabled = result.storiesUnseenEnabled !== false;
        });
        
        // Listen for changes from the popup in real-time
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && changes.storiesUnseenEnabled) {
                isEnabled = changes.storiesUnseenEnabled.newValue !== false;
                console.log(`[Stories Unseen] Toggled ${isEnabled ? 'ON' : 'OFF'}`);
            }
        });
    }

    function isStoriesSeenRequest(body) {
        if (typeof body === 'string') return body.includes('storiesUpdateSeenStateMutation');
        if (body instanceof URLSearchParams) return body.toString().includes('storiesUpdateSeenStateMutation');
        if (body instanceof FormData) {
            let str = '';
            body.forEach((value, key) => { str += key + '=' + value + '&'; });
            return str.includes('storiesUpdateSeenStateMutation');
        }
        return false;
    }

    const fakeResponse = '{"data":{"direct_message_thread_update_seen_state":{"bucket":{"__typename":"DirectMessageThreadBucket","id":"dummy","is_bucket_seen_by_viewer":false},"story":{"id":"dummy","story_card_seen_state":{"is_seen_by_viewer":false}}}}}';

    // 1. Intercept Fetch API
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        if (!isEnabled) return originalFetch.apply(this, args); // Bypass if disabled

        const url = args[0];
        const options = args[1] || {};
        
        if (typeof url === 'string' && url.includes('/api/graphql/')) {
            if (isStoriesSeenRequest(options.body)) {
                console.log("[Stories Unseen] 🛑 Blocked (Fetch)");
                return Promise.resolve(new Response(fakeResponse, { 
                    status: 200, 
                    headers: { 'Content-Type': 'application/json' } 
                }));
            }
        }
        return originalFetch.apply(this, args);
    };

    // 2. Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._unseen_url = url;
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function(body) {
        if (!isEnabled) return originalXHRSend.apply(this, arguments); // Bypass if disabled

        if (typeof this._unseen_url === 'string' && this._unseen_url.includes('/api/graphql/')) {
            if (isStoriesSeenRequest(body)) {
                console.log("[Stories Unseen] 🛑 Blocked (XHR)");
                
                Object.defineProperty(this, 'responseText', { value: fakeResponse });
                Object.defineProperty(this, 'response', { value: fakeResponse });
                Object.defineProperty(this, 'status', { value: 200 });
                
                setTimeout(() => {
                    Object.defineProperty(this, 'readyState', { value: 4 });
                    this.dispatchEvent(new Event('readystatechange'));
                    this.dispatchEvent(new Event('load'));
                    this.dispatchEvent(new Event('loadend'));
                    if (typeof this.onload === 'function') this.onload();
                }, 0);
                return;
            }
        }
        return originalXHRSend.apply(this, arguments);
    };
})();