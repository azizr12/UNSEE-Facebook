(function() {
    if (window.__unseen_core_injected) return;
    window.__unseen_core_injected = true;

    // Helper to read from localStorage
    const getSetting = (key, defaultValue) => {
        const val = localStorage.getItem('unseen_' + key);
        return val !== null ? val === 'true' : defaultValue;
    };

    let blockRead = getSetting('DISABLE_READ', true);
    let blockTyping = getSetting('DISABLE_TYPING', true);
    let blockStories = getSetting('DISABLE_STORIES_SEEN', true);

    console.log('[Unseen] Core Active', { blockRead, blockTyping, blockStories });

    // ==========================================
    // 1. BLOCK STORIES SEEN (Network Interception)
    // ==========================================
    if (blockStories) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            const options = args[1] || {};
            const body = options.body;

            if (typeof url === 'string' && url.includes('/api/graphql/')) {
                if (typeof body === 'string' && body.includes('storiesUpdateSeenStateMutation')) {
                    console.log('[Unseen] 🛑 Blocked storiesUpdateSeenStateMutation (Fetch)');
                    return Promise.resolve(new Response('{"data":{"direct_message_thread_update_seen_state":{}}}', {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                }
            }
            return originalFetch.apply(this, args);
        };

        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._unseen_url = url;
            return originalXHROpen.apply(this, [method, url, ...rest]);
        };

        XMLHttpRequest.prototype.send = function(body) {
            if (typeof this._unseen_url === 'string' && this._unseen_url.includes('/api/graphql/')) {
                if (typeof body === 'string' && body.includes('storiesUpdateSeenStateMutation')) {
                    console.log('[Unseen] 🛑 Blocked storiesUpdateSeenStateMutation (XHR)');
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
    }

    // ==========================================
    // 2. BLOCK TYPING & READ (Module Interception)
    // ==========================================
    const originalDefine = window.__d;
    if (typeof originalDefine === 'function') {
        window.__d = function(factory, moduleId, ...rest) {
            const moduleName = String(moduleId);
            let newFactory = factory;

            // Block Typing at source code level
            if (blockTyping && moduleName.includes("MAWSecureTypingState")) {
                try {
                    newFactory = new Function('return ' + factory.toString().replaceAll("sendChatStateFromComposer", "none"))();
                } catch (e) {
                    console.error('[Unseen] Typing hook failed', e);
                }
            }

            const wrappedFactory = function(require, module, exports, ...args) {
                newFactory.call(this, require, module, exports, ...args);
                const target = module?.exports || exports;

                if (target) {
                    // Block Read Receipts (Resilient iteration instead of hardcoded indices)
                    if (blockRead && (moduleName.includes("LSOptimisticMarkThreadReadV2") || moduleName.includes("useMAWMarkThreadAsRead"))) {
                        for (const key in target) {
                            const func = target[key]?.default || target[key];
                            if (typeof func === 'function') {
                                const orig = func;
                                const wrapper = function(...fnArgs) {
                                    const callback = fnArgs[fnArgs.length - 1];
                                    if (callback?.resolve) {
                                        console.log('[Unseen] 🛑 Blocked Read Receipt');
                                        return callback.resolve([]);
                                    }
                                    return orig.apply(this, fnArgs);
                                };
                                if (target[key]?.default) target[key].default = wrapper;
                                else target[key] = wrapper;
                            }
                        }
                    }

                    // Block Typing Indicator (Fallback)
                    if (blockTyping && moduleName.includes("LSSendTypingIndicator")) {
                        for (const key in target) {
                            const func = target[key]?.default || target[key];
                            if (typeof func === 'function') {
                                const orig = func;
                                const wrapper = function(...fnArgs) {
                                    if (fnArgs.length > 2) {
                                        console.log('[Unseen] 🛑 Blocked Typing Indicator');
                                        fnArgs[2] = false;
                                    }
                                    return orig.apply(this, fnArgs);
                                };
                                if (target[key]?.default) target[key].default = wrapper;
                                else target[key] = wrapper;
                            }
                        }
                    }
                }
            };

            return originalDefine.call(this, wrappedFactory, moduleId, ...rest);
        };
    }

    // ==========================================
    // 3. DYNAMIC SETTING UPDATES (No Reload Required)
    // ==========================================
    window.addEventListener('storage', (event) => {
        if (event.key === 'unseen_DISABLE_STORIES_SEEN') {
            blockStories = event.newValue === 'true';
            console.log(`[Unseen] 🔄 Stories blocking updated to: ${blockStories}`);
        }
        if (event.key === 'unseen_DISABLE_READ') {
            blockRead = event.newValue === 'true';
            console.log(`[Unseen] 🔄 Read receipts blocking updated to: ${blockRead}`);
        }
        if (event.key === 'unseen_DISABLE_TYPING') {
            blockTyping = event.newValue === 'true';
            console.log(`[Unseen] 🔄 Typing indicator blocking updated to: ${blockTyping}`);
        }
    });
})();