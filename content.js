(function() {
    if (window.__unseen_core_injected) return;
    window.__unseen_core_injected = true;

    // Read settings from localStorage in the MAIN world
    const getSetting = (key, defaultValue) => {
        const val = localStorage.getItem('unseen_' + key);
        return val !== null ? val === 'true' : defaultValue;
    };

    const blockStories = getSetting('DISABLE_STORIES_SEEN', true);
    console.log('[UNSEEN] Core Active - Story Blocking:', blockStories);

    // ==========================================
    // BLOCK STORIES SEEN (Network Interception)
    // ==========================================
    if (blockStories) {
        // Intercept Fetch API
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            const options = args[1] || {};
            const body = options.body;

            if (typeof url === 'string' && url.includes('/api/graphql/')) {
                if (typeof body === 'string' && body.includes('storiesUpdateSeenStateMutation')) {
                    console.log('[UNSEEN] [BLOCK] Blocked storiesUpdateSeenStateMutation (Fetch)');
                    return Promise.resolve(new Response('{"data":{"direct_message_thread_update_seen_state":{}}}', { 
                        status: 200, 
                        headers: { 'Content-Type': 'application/json' } 
                    }));
                }
            }
            return originalFetch.apply(this, args);
        };

        // Intercept XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._unseen_url = url;
            return originalXHROpen.apply(this, [method, url, ...rest]);
        };

        XMLHttpRequest.prototype.send = function(body) {
            if (typeof this._unseen_url === 'string' && this._unseen_url.includes('/api/graphql/')) {
                if (typeof body === 'string' && body.includes('storiesUpdateSeenStateMutation')) {
                    console.log('[UNSEEN] [BLOCK] Blocked storiesUpdateSeenStateMutation (XHR)');
                    Object.defineProperty(this, 'responseText', { value: '{"data":{"direct_message_thread_update_seen_state":{}}}' });
                    Object.defineProperty(this, 'response', { value: '{"data":{"direct_message_thread_update_seen_state":{}}}' });
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

        // Intercept sendBeacon (Background telemetry)
        const originalBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function(url, data) {
            if (typeof data === 'string' && data.includes('storiesUpdateSeenStateMutation')) {
                console.log('[UNSEEN] [BLOCK] Blocked story tracking beacon');
                return true; 
            }
            return originalBeacon.apply(this, arguments);
        };
    }
})();