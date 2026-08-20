(function() {
    if (window.__unseen_debug) return;
    window.__unseen_debug = true;

    console.log("%c[UNSEEN DEBUG] === CORE SCRIPT STARTED ===", "background: #222; color: #bada55; font-size: 16px; padding: 5px;");
    
    window.unseen_config = window.unseen_config || {
        DISABLE_READ: { enable: true },
        DISABLE_TYPING: { enable: true },
        DISABLE_STORIES_SEEN: { enable: true }
    };
    console.log("[UNSEEN DEBUG] Config loaded:", window.unseen_config);

    function compileCode(codeStr) {
        try {
            const id = 'fn_' + Math.random().toString(36).substr(2, 9);
            window.__unseen_cache = window.__unseen_cache || {};
            const script = document.createElement('script');
            script.textContent = `window.__unseen_cache["${id}"] = ${codeStr};`;
            document.documentElement.appendChild(script);
            script.remove();
            return window.__unseen_cache[id];
        } catch (e) {
            console.error("[UNSEEN DEBUG] ❌ CSP Compile Failed:", e);
            return null;
        }
    }

    const TARGETS = {
        "MAWSecureTypingState": {
            type: "CODE",
            apply: (code) => code.replaceAll("sendChatStateFromComposer", "none")
        },
        "StoriesSuspenseBucketContainer.react": {
            type: "CODE",
            apply: (code) => {
                console.log("[UNSEEN DEBUG] 🎯 Found StoriesSuspenseBucketContainer.react. Snippet:", code.substring(0, 300));
                // Try multiple regex patterns in case Facebook changed spacing or syntax
                let newCode = code.replace(/,onCardSeen:\s*(\w+),/g, ",onCardSeen:window?.unseen_config?.DISABLE_STORIES_SEEN?.enable ? ()=>{} : $1,");
                if (newCode === code) {
                    newCode = code.replace(/onCardSeen\s*:\s*(\w+)/g, "onCardSeen: window?.unseen_config?.DISABLE_STORIES_SEEN?.enable ? ()=>{} : $1");
                }
                return newCode;
            }
        },
        "LSOptimisticMarkThreadReadV2StoredProcedure": {
            type: "EXPORT",
            apply: (exports) => {
                if (exports[6]?.default) {
                    const orig = exports[6].default;
                    exports[6].default = function(...args) {
                        if (window?.unseen_config?.DISABLE_READ?.enable && args[args.length-1]?.resolve) {
                            console.log("%c[UNSEEN] ✋ BLOCKED Read Receipt (StoredProcedure)", "color: green; font-weight:bold;");
                            return args[args.length-1].resolve([]);
                        }
                        return orig.apply(this, args);
                    };
                    return true;
                }
                return false;
            }
        },
        "useMAWMarkThreadAsRead": {
            type: "EXPORT",
            apply: (exports) => {
                if (exports[6]?.default) {
                    const orig = exports[6].default;
                    exports[6].default = function(...args) {
                        if (window?.unseen_config?.DISABLE_READ?.enable) {
                            console.log("%c[UNSEEN] ✋ BLOCKED Read Receipt (React Hook)", "color: green; font-weight:bold;");
                            return () => {};
                        }
                        return orig.apply(this, args);
                    };
                    return true;
                }
                return false;
            }
        },
        "LSSendTypingIndicator": {
            type: "EXPORT",
            apply: (exports) => {
                const target = exports[4]?.exports?.default || exports[4]?.exports;
                if (typeof target === "function") {
                    const orig = target;
                    const wrapped = function(...args) {
                        if (window?.unseen_config?.DISABLE_TYPING?.enable && args.length > 2) {
                            console.log("%c[UNSEEN] ✋ BLOCKED Typing Indicator", "color: green; font-weight:bold;");
                            args[2] = false;
                        }
                        return orig.apply(this, args);
                    };
                    if (exports[4]?.exports?.default) exports[4].exports.default = wrapped;
                    else exports[4].exports = wrapped;
                    return true;
                }
                return false;
            }
        }
    };

    if (typeof window.__d !== 'function') {
        console.error("%c[UNSEEN DEBUG] ❌ FATAL: window.__d is not a function!", "color: red; font-size: 14px;");
        return;
    }

    console.log("%c[UNSEEN DEBUG] ✅ window.__d intercepted. Listening for modules...", "color: cyan; font-size: 14px;");

    const originalDefine = window.__d;
    const hookedSet = new Set();

    window.__d = function(factory, moduleId, ...rest) {
        const moduleName = String(moduleId);
        const target = TARGETS[moduleName];

        // 🔍 DIAGNOSTIC: Log any module with "Stories", "Seen", or "Card" in the name
        if (moduleName.includes("Stories") || moduleName.includes("Seen") || moduleName.includes("Card")) {
            console.log(`[UNSEEN DEBUG] 🔍 Scanning potential story module: ${moduleName}`);
        }

        if (target) {
            console.log(`%c[UNSEEN DEBUG] 🎯 TARGET ACQUIRED: ${moduleName} (${target.type})`, "color: yellow; background: #333; padding: 2px 5px;");
            
            if (target.type === "CODE") {
                try {
                    const originalStr = factory.toString();
                    const newStr = target.apply(originalStr);
                    
                    if (newStr === originalStr) {
                        console.warn(`%c[UNSEEN DEBUG] ⚠️ CODE REPLACE FAILED for ${moduleName}. The regex didn't match.`, "color: orange;");
                        // Log the exact code around 'onCardSeen' so we can fix the regex
                        const idx = originalStr.indexOf("onCardSeen");
                        if (idx !== -1) {
                            console.log("[UNSEEN DEBUG] Code snippet around 'onCardSeen':", originalStr.substring(idx - 60, idx + 120));
                        } else {
                            console.log("[UNSEEN DEBUG] 'onCardSeen' not found in this module at all.");
                        }
                    } else {
                        console.log(`%c[UNSEEN DEBUG] ✅ CODE REPLACE SUCCESS for ${moduleName}.`, "color: green;");
                        factory = compileCode(newStr) || factory;
                    }
                } catch (e) {
                    console.error(`[UNSEEN DEBUG] ❌ Error during CODE replace for ${moduleName}:`, e);
                }
            }

            const originalFactory = factory;
            factory = function(require, module, exports, ...args) {
                originalFactory.call(this, require, module, exports, ...args);
                
                const exportTarget = module?.exports || exports;
                if (exportTarget) {
                    const success = target.apply(exportTarget);
                    if (success) {
                        if (!hookedSet.has(moduleName)) {
                            console.log(`%c[UNSEEN DEBUG] ✅ EXPORT WRAP SUCCESS for ${moduleName}`, "color: green; font-weight: bold;");
                            hookedSet.add(moduleName);
                        }
                    } else {
                        console.warn(`%c[UNSEEN DEBUG] ⚠️ EXPORT WRAP FAILED for ${moduleName}. Expected structure not found.`, "color: orange;");
                    }
                }
            };
        }

        return originalDefine.call(this, factory, moduleId, ...rest);
    };
})();