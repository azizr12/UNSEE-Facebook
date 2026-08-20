(function() {
    if (window.__unseen_bridge_injected) return;
    window.__unseen_bridge_injected = true;

    const DEFAULTS = { DISABLE_READ: false, DISABLE_TYPING: false, DISABLE_STORIES_SEEN: true };

    chrome.storage.local.get(DEFAULTS, (settings) => {
        const script = document.createElement('script');
        script.textContent = '(' + injectCore.toString() + ')(' + JSON.stringify(settings) + ');';
        (document.head || document.documentElement).prepend(script);
        script.remove();
    });

    function injectCore(settings) {
        if (window.__unseen_core_injected) return;
        window.__unseen_core_injected = true;

        const blockRead = settings.DISABLE_READ;
        const blockTyping = settings.DISABLE_TYPING;
        const blockStories = settings.DISABLE_STORIES_SEEN;

        console.log('[Unseen] Core Active', { blockRead, blockTyping, blockStories });

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

        const originalDefine = window.__d;
        if (typeof originalDefine === 'function') {
            window.__d = function(factory, moduleId, ...rest) {
                const moduleName = String(moduleId);
                let newFactory = factory;

                if (blockTyping && moduleName.includes("MAWSecureTypingState")) {
                    try {
                        newFactory = new Function('return ' + factory.toString().replaceAll("sendChatStateFromComposer", "none"))();
                    } catch (e) {}
                }

                const wrappedFactory = function(require, module, exports, ...args) {
                    newFactory.call(this, require, module, exports, ...args);

                    const target = module?.exports || exports;
                    if (target) {
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
    }
})();
