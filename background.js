// content.js (Must run in "world": "MAIN")
(function() {
    if (window.__unseen_debug) return;
    window.__unseen_debug = true;

    console.log("%c[UNSEEN] === CORE SCRIPT STARTED ===", "background: #222; color: #bada55; font-size: 14px; padding: 5px;");
    
    // Fallback config (will be overwritten by config-injector.js)
    window.unseen_config = window.unseen_config || {
        DISABLE_STORIES_SEEN: { enable: true }
    };

    // Helper to safely compile modified code under Facebook's strict CSP
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
            console.error("[UNSEEN] ❌ CSP Compile Failed:", e);
            return null;
        }
    }

    const TARGETS = {
        "StoriesSuspenseBucketContainer.react": {
            type: "CODE",
            apply: (codeStr) => {
                if (!window.unseen_config?.DISABLE_STORIES_SEEN?.enable) {
                    return codeStr; // Feature disabled, return original
                }
                // More resilient regex: matches "onCardSeen: someFunction" with flexible spacing
                return codeStr.replace(/(onCardSeen\s*:\s*)(\w+)/g, "$1(window.unseen_config?.DISABLE_STORIES_SEEN?.enable ? ()=>{} : $2)");
            }
        }
    };

    // Ensure Facebook's module system is present before hooking
    if (typeof window.__d !== 'function') {
        console.warn("[UNSEEN] window.__d not found yet. Retrying...");
        setTimeout(() => window.location.reload(), 1000); // Simple retry mechanism
        return;
    }

    const originalDefine = window.__d;
    const hookedSet = new Set();

    window.__d = function(factory, moduleId, ...rest) {
        const moduleName = String(moduleId);
        const target = TARGETS[moduleName];

        if (target && target.type === "CODE" && !hookedSet.has(moduleName)) {
            try {
                const originalStr = factory.toString();
                const newStr = target.apply(originalStr);
                
                if (newStr !== originalStr) {
                    const compiledFactory = compileCode(newStr);
                    if (compiledFactory) {
                        factory = compiledFactory;
                        hookedSet.add(moduleName);
                        console.log(`%c[UNSEEN] ✅ Successfully hooked: ${moduleName}`, "color: #4caf50;");
                    }
                }
            } catch (e) {
                console.error(`[UNSEEN] ❌ Failed to hook ${moduleName}:`, e);
            }
        }

        // Execute the original (or safely modified) factory
        return originalDefine.call(this, factory, moduleId, ...rest);
    };
})();