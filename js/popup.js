import { loadState, saveState, makeId } from "./storage.js";

let state = { folders: [], prompts: [] };
let selectedFolderId = null;

const listView = document.getElementById("list-view");
const newPromptView = document.getElementById("new-prompt-view");
const promptList = document.getElementById("prompt-list");
const searchInput = document.getElementById("popup-search");
const viewAllLink = document.getElementById("view-all");
const newPromptBtn = document.getElementById("new-prompt");

// Form elements
const titleInput = document.getElementById("prompt-title");
const contentInput = document.getElementById("prompt-content");
const folderSelect = document.getElementById("popup-folder-select");
const folderTrigger = folderSelect.querySelector(".custom-select__trigger span");
const folderOptions = folderSelect.querySelector(".custom-select__options");
const saveBtn = document.getElementById("save-new");
const cancelBtn = document.getElementById("cancel-new");

async function init() {
    state = await loadState();
    renderPrompts();
    searchInput.addEventListener("input", renderPrompts);

    promptList.addEventListener("click", handleCopy);
    chrome.storage.onChanged.addListener(handleStorageChange);

    viewAllLink.addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });

    newPromptBtn.addEventListener("click", showNewPromptView);
    cancelBtn.addEventListener("click", showListView);
    saveBtn.addEventListener("click", handleSave);

    // Folder dropdown logic
    folderSelect.addEventListener("click", (e) => {
        if (e.target.closest(".custom-select__trigger")) {
            folderSelect.classList.toggle("open");
        }
    });

    folderOptions.addEventListener("click", (e) => {
        const option = e.target.closest(".custom-option");
        if (!option) return;
        selectedFolderId = option.dataset.value;
        folderTrigger.textContent = option.textContent;
        folderSelect.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
        if (!folderSelect.contains(e.target)) {
            folderSelect.classList.remove("open");
        }
    });

    initAutoScrollbars();
}

function initAutoScrollbars() {
    document.addEventListener('scroll', (e) => {
        const target = e.target.nodeType === 9 ? document.documentElement : e.target;

        // Cancel any pending fade or hide
        if (target.fadeInterval) {
            clearInterval(target.fadeInterval);
            target.fadeInterval = null;
        }
        clearTimeout(target.scrollTimeout);

        // Show immediately
        target.style.setProperty('--sb-opacity', '1');

        // Wait then fade
        target.scrollTimeout = setTimeout(() => {
            let opacity = 1;
            target.fadeInterval = setInterval(() => {
                opacity -= 0.1; // 10 steps
                if (opacity <= 0) {
                    opacity = 0;
                    clearInterval(target.fadeInterval);
                    target.fadeInterval = null;
                }
                target.style.setProperty('--sb-opacity', opacity);
            }, 12); // 120ms total duration
        }, 1000);
    }, true); // Capture phase to detect all scrolls
}

function showNewPromptView() {
    listView.classList.add("hidden");
    newPromptView.classList.remove("hidden");

    // Reset form
    titleInput.value = "";
    contentInput.value = "";

    // Render folders
    folderOptions.innerHTML = "";
    const folders = state.folders.filter(f => f.id !== "all");

    // Add "General" option (conceptually "all" or undefined folderId, but let's use explicit folders if possible)
    // If no folders exist, maybe just show "General"?
    // The data model allows folderId to be undefined.
    // Let's add a "General" / "No Folder" option if needed, or just list existing folders.
    // If user has folders, they probably want to choose one.

    if (folders.length === 0) {
        folderTrigger.textContent = "General";
        selectedFolderId = null;
    } else {
        // Default to first folder
        selectedFolderId = folders[0].id;
        folderTrigger.textContent = folders[0].name;

        folders.forEach(folder => {
            const div = document.createElement("div");
            div.className = "custom-option";
            div.dataset.value = folder.id;
            div.textContent = folder.name;
            folderOptions.appendChild(div);
        });
    }
}

function showListView() {
    newPromptView.classList.add("hidden");
    listView.classList.remove("hidden");
}

async function handleSave() {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title || !content) {
        // Simple validation feedback
        if (!title) titleInput.style.borderColor = "red";
        if (!content) contentInput.style.borderColor = "red";
        setTimeout(() => {
            titleInput.style.borderColor = "#000";
            contentInput.style.borderColor = "#000";
        }, 2000);
        return;
    }

    const newPrompt = {
        id: makeId("prompt"),
        title,
        content,
        folderId: selectedFolderId || undefined,
        order: state.prompts.length, // Append to end
        updatedAt: Date.now()
    };

    state.prompts.unshift(newPrompt); // Add to top of list
    await saveState(state);

    showListView();
    renderPrompts();
}

function handleStorageChange(changes) {
    if (changes.promptManagerState) {
        state = changes.promptManagerState.newValue || state;
        renderPrompts();
    }
}

function handleCopy(event) {
    const btn = event.target.closest("[data-copy]");
    if (!btn) return;
    const id = btn.dataset.copy;
    const prompt = state.prompts.find((item) => item.id === id);
    if (!prompt) return;
    navigator.clipboard.writeText(prompt.content);
}

function renderPrompts() {
    promptList.innerHTML = "";
    const query = searchInput.value.trim().toLowerCase();
    const filtered = state.prompts.filter((prompt) => {
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
      <button class="copy-btn" data-copy="${prompt.id}">COPY</button>
      <p class="prompt-content">${sanitize(prompt.content)}</p>
    `;

        // Local copy handling
        const copyBtn = item.querySelector(".copy-btn");
        copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            copyBtn.textContent = "COPIED";
            navigator.clipboard.writeText(prompt.content).then(() => showToast("Copied"));
        });

        // Reset on mouseleave (blur only)
        item.addEventListener("mouseleave", () => {
            copyBtn.blur();
        });

        // Reset text on mouseenter
        item.addEventListener("mouseenter", () => {
            copyBtn.textContent = "COPY";
        });

        promptList.appendChild(item);
    });
}

function sanitize(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML.replace(/\n/g, "<br>");
}


init();
