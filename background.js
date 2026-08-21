const UPDATE_CHECK_URL = "https://raw.githubusercontent.com/azizr12/UNSEE-Facebook/main/update.json";
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Check once every 24 hours

chrome.runtime.onInstalled.addListener(() => {
    checkForUpdates();
    chrome.alarms.create("checkForUpdates", { periodInMinutes: 1440 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkForUpdates") {
        checkForUpdates();
    }
});

async function checkForUpdates() {
    try {
        const response = await fetch(UPDATE_CHECK_URL);
        if (!response.ok) return;
        
        const updateData = await response.json();
        const currentVersion = chrome.runtime.getManifest().version;
        
        // Simple semantic version comparison
        if (updateData.version > currentVersion) {
            showUpdateNotification(updateData);
        }
    } catch (error) {
        console.error("Update check failed:", error);
    }
}

function showUpdateNotification(updateData) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "UNSEE for Facebook: Update Available",
        message: `Version ${updateData.version} is ready.\n\n${updateData.releaseNotes}\n\nClick here to download the update.`,
        buttons: [{ title: "Download Update" }, { title: "Dismiss" }]
    });
}

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
        chrome.tabs.create({ url: "https://github.com/azizr12/UNSEE-Facebook/releases/latest" });
    }
    chrome.notifications.clear(notificationId);
});

chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.tabs.create({ url: "https://github.com/azizr12/UNSEE-Facebook/releases/latest" });
    chrome.notifications.clear(notificationId);
});