(function() {
    if (window.__unseen_debug) return;
    window.__unseen_debug = true;

    console.log("%c[UNSEEN DEBUG] === CORE SCRIPT STARTED ===", "background: #222; color: #bada55; font-size: 16px; padding: 5px;");
    
    window.unseen_config = window.unseen_config || {
        DISABLE_STORIES_SEEN: { enable: true }
    };

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
        "StoriesSuspenseBucketContainer.react": {
            type: "CODE",
            apply: (code) => {
                let newCode = code.replace(/,onCardSeen:\s*(\w+),/g, ",onCardSeen:window?.unseen_config?.DISABLE_STORIES_SEEN?.enable ? ()=>{} : $1,");
                if (newCode === code) {
                    newCode = code.replace(/onCardSeen\s*:\s*(\w+)/g, "onCardSeen: window?.unseen_config?.DISABLE_STORIES_SEEN?.enable ? ()=>{} : $1");
                }
                return newCode;
            }
        }
    };

    if (typeof window.__d !== 'function') return;

    const originalDefine = window.__d;
    const hookedSet = new Set();

    window.__d = function(factory, moduleId, ...rest) {
        const moduleName = String(moduleId);
        const target = TARGETS[moduleName];

        if (target) {
            if (target.type === "CODE") {
                try {
                    const originalStr = factory.toString();
                    const newStr = target.apply(originalStr);
                    if (newStr !== originalStr) {
                        factory = compileCode(newStr) || factory;
                    }
                } catch (e) {}
            }

            const originalFactory = factory;
            factory = function(require, module, exports, ...args) {
                originalFactory.call(this, require, module, exports, ...args);
                const exportTarget = module?.exports || exports;
                if (exportTarget) {
                    const success = target.apply(exportTarget);
                    if (success && !hookedSet.has(moduleName)) {
                        hookedSet.add(moduleName);
                    }
                }
            };
        }
        return originalDefine.call(this, factory, moduleId, ...rest);
    };
})();