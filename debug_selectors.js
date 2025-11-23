(() => {
    console.log("%c[DEBUG] Testing New Chat Selectors...", "color: yellow; font-size: 14px; font-weight: bold;");

    const selectors = [
        'div[data-testid="new-chat-button"]',
        'span[class*="new-chat"]',
        'span.mat-mdc-button-touch-target',
        'button[aria-label="New chat"]',
        'div[role="button"][aria-label="New chat"]',
        'a[href="https://gemini.google.com/app"]',
        'a[href="/app"]'
    ];

    let found = false;

    // 1. Check Selectors
    selectors.forEach(sel => {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
            console.log(`%c[MATCH] Selector found: "${sel}" (${els.length} elements)`, "color: lime");
            els.forEach(el => {
                console.log("   Element:", el);
                // Highlight it
                el.style.border = "5px solid red";
                found = true;
            });
        } else {
            console.log(`[FAIL] Selector not found: "${sel}"`);
        }
    });

    // 2. Check Text Content
    console.log("Checking for text 'New chat'...");
    const allSpans = document.querySelectorAll('span');
    let textFound = false;
    for (const span of allSpans) {
        if (span.innerText.trim() === "New chat" || span.innerText.trim() === "New conversation") {
            console.log(`%c[MATCH] Found text "${span.innerText}" in span:`, "color: lime", span);
            span.style.border = "5px solid blue";

            const parentBtn = span.closest('button, div[role="button"]');
            if (parentBtn) {
                console.log("   Parent button found:", parentBtn);
                parentBtn.style.border = "5px solid magenta";
            }
            textFound = true;
            found = true;
        }
    }

    if (!found) {
        console.log("%c[ERROR] No 'New Chat' button found via any method!", "color: red; font-weight: bold;");
    } else {
        console.log("%c[SUCCESS] Found potential buttons (highlighted in RED/BLUE/MAGENTA).", "color: lime; font-weight: bold;");
    }
})();
