import { trackEvent } from "./analytics.js";

chrome.runtime.onInstalled.addListener((details) => {
    console.log("MonoPrompt template installed");
    if (details.reason === "install") {
        trackEvent("extension_install");
    } else if (details.reason === "update") {
        trackEvent("extension_update", { version: chrome.runtime.getManifest().version });
    }
});
