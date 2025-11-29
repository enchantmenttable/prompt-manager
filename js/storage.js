const STORAGE_KEY = "promptManagerState";

function createDefaultState() {
  return {
    folders: [
      { id: "all", name: "All Prompts", locked: true, order: -1 },
      { id: "default", name: "My Prompts", locked: false, order: 0 },
    ],
    prompts: [],
  };
}

function makeId(prefix = "id") {
  const rand = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${rand}`;
}

async function loadState() {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  if (stored) {
    const fixed = ensureBaselineFolders(stored);
    if (fixed !== stored) {
      await chrome.storage.local.set({ [STORAGE_KEY]: fixed });
    }
    return fixed;
  }
  const defaults = createDefaultState();
  await chrome.storage.local.set({ [STORAGE_KEY]: defaults });
  return defaults;
}

function saveState(state) {
  return chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function ensureBaselineFolders(state) {
  const hasNonAll = state.folders?.some((f) => f.id !== "all");
  if (hasNonAll) return state;
  const next = {
    ...state,
    folders: [
      ...(state.folders || []).filter((f) => f.id === "all"),
      { id: "default", name: "My Prompts", locked: false, order: 0 },
    ],
  };
  return next;
}

export { createDefaultState, loadState, makeId, saveState };
