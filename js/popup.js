import { loadState } from "./storage.js";

let state = { folders: [], prompts: [] };
let activeFolderId = "all";
let toastTimer = null;

const tabBar = document.getElementById("tab-bar");
const promptList = document.getElementById("prompt-list");
const searchInput = document.getElementById("popup-search");
const toast = document.getElementById("toast");
const openOptionsButton = document.getElementById("open-options");

async function init() {
  state = await loadState();
  renderTabs();
  renderPrompts();
  searchInput.addEventListener("input", renderPrompts);
  tabBar.addEventListener("click", handleTabClick);
  promptList.addEventListener("click", handleCopy);
  chrome.storage.onChanged.addListener(handleStorageChange);
  openOptionsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

function handleStorageChange(changes) {
  if (changes.promptManagerState) {
    state = changes.promptManagerState.newValue || state;
    renderTabs();
    renderPrompts();
  }
}

function handleTabClick(event) {
  const btn = event.target.closest("[data-id]");
  if (!btn) return;
  const { id } = btn.dataset;
  if (!id) return;
  activeFolderId = id;
  renderTabs();
  renderPrompts();
}

function handleCopy(event) {
  const btn = event.target.closest("[data-copy]");
  if (!btn) return;
  const id = btn.dataset.copy;
  const prompt = state.prompts.find((item) => item.id === id);
  if (!prompt) return;
  navigator.clipboard.writeText(prompt.content).then(() => showToast("Copied"));
}

function renderTabs() {
  tabBar.innerHTML = "";
  const folders = [...state.folders].sort((a, b) => {
    if (a.id === "all") return -1;
    if (b.id === "all") return 1;
    return a.name.localeCompare(b.name);
  });
  folders.forEach((folder) => {
    const count =
      folder.id === "all"
        ? state.prompts.length
        : state.prompts.filter((p) => p.folderId === folder.id).length;
    const button = document.createElement("button");
    button.className = `tab${folder.id === activeFolderId ? " active" : ""}`;
    button.dataset.id = folder.id;
    button.setAttribute("role", "tab");
    button.textContent = `${folder.name} (${count})`;
    tabBar.appendChild(button);
  });
}

function renderPrompts() {
  promptList.innerHTML = "";
  const query = searchInput.value.trim().toLowerCase();
  const filtered = state.prompts.filter((prompt) => {
    const matchesFolder = activeFolderId === "all" || prompt.folderId === activeFolderId;
    if (!matchesFolder) return false;
    if (!query) return true;
    return (
      (prompt.title || "").toLowerCase().includes(query) ||
      prompt.content.toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No prompts found.";
    promptList.appendChild(empty);
    return;
  }

  filtered.forEach((prompt) => {
    const folderName =
      state.folders.find((f) => f.id === prompt.folderId)?.name || "General";
    const item = document.createElement("article");
    item.className = "prompt-item";
    item.innerHTML = `
      <h2 class="prompt-headline">${prompt.title || "Untitled prompt"}</h2>
      <p class="prompt-content">${sanitize(prompt.content)}</p>
      <div class="prompt-footer">
        <span>${folderName}</span>
        <button class="copy-btn" data-copy="${prompt.id}">Copy</button>
      </div>
    `;
    promptList.appendChild(item);
  });
}

function sanitize(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML.replace(/\n/g, "<br>");
}

function showToast(message) {
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.textContent = ""), 1400);
}

init();
