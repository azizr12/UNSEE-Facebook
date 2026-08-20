(function() {
    if (window.__unseen_core_injected) return;
    window.__unseen_core_injected = true;

    // Read settings from localStorage (simple, zero-dependency storage for MAIN world)
    const getSetting = (key, defaultValue) => {
        const val = localStorage.getItem('unseen_' + key);
        return val !== null ? val === 'true' : defaultValue;
    };

    const blockRead = getSetting('DISABLE_READ', true);
    const blockTyping = getSetting('DISABLE_TYPING', true);
    const blockStories = getSetting('DISABLE_STORIES_SEEN', true);

    console.log('[Unseen] Core Active', { blockRead, blockTyping, blockStories });

    // ==========================================
    // 1. BLOCK STORIES SEEN (Network Interception)
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
                    console.log('[Unseen] 🛑 Blocked storiesUpdateSeenStateMutation (Fetch)');
                    // Return a fake successful response so Facebook's UI doesn't break
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
                    console.log('[Unseen] 🛑 Blocked storiesUpdateSeenStateMutation (XHR)');
                    // Mock a successful response
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
                } catch (e) {}
            }

            const wrappedFactory = function(require, module, exports, ...args) {
                newFactory.call(this, require, module, exports, ...args);
                
                const target = module?.exports || exports;
                if (target) {
                    // Block Read Receipts
                    if (blockRead && (moduleName.includes("LSOptimisticMarkThreadReadV2") || moduleName.includes("useMAWMarkThreadAsRead"))) {
                        if (target[6]?.default) {
                            const orig = target[6].default;
                            target[6].default = function(...fnArgs) {
                                const callback = fnArgs[fnArgs.length - 1];
                                if (callback?.resolve) {
                                    console.log('[Unseen] 🛑 Blocked Read Receipt');
                                    return callback.resolve([]);
                                }
                                return orig.apply(this, fnArgs);
                            };
                        }
                    }
                    
                    // Block Typing Indicator (Fallback)
                    if (blockTyping && moduleName.includes("LSSendTypingIndicator")) {
                        const typingTarget = target[4]?.exports?.default || target[4]?.exports;
                        if (typeof typingTarget === "function") {
                            const orig = typingTarget;
                            const wrapped = function(...fnArgs) {
                                if (fnArgs.length > 2) {
                                    console.log('[Unseen] 🛑 Blocked Typing Indicator');
                                    fnArgs[2] = false;
                                }
                                return orig.apply(this, fnArgs);
                            };
                            if (target[4]?.exports?.default) target[4].exports.default = wrapped;
                            else target[4].exports = wrapped;
                        }
                    }
                }
            };

            return originalDefine.call(this, wrappedFactory, moduleId, ...rest);
        };
    }
})();
