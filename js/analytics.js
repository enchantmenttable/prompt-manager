const MEASUREMENT_ID = "G-YSV57GG43E";
const API_SECRET = "dW_iqxb_SvS7ES_G_tK8eg";
const ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

async function getClientId() {
    const stored = await chrome.storage.local.get("ga_client_id");
    if (stored.ga_client_id) return stored.ga_client_id;
    const id = crypto.randomUUID();
    await chrome.storage.local.set({ ga_client_id: id });
    return id;
}

export async function trackEvent(eventName, params = {}) {
    try {
        const clientId = await getClientId();
        await fetch(ENDPOINT, {
            method: "POST",
            body: JSON.stringify({
                client_id: clientId,
                events: [{ name: eventName, params }],
            }),
        });
    } catch (e) {
        // Analytics failures should never break the extension
    }
}
