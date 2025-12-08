import { sanitize } from "./dom.js";

// DOM Elements
export const folderList = document.getElementById("folder-list");
export const promptGrid = document.getElementById("prompt-grid");
const viewTitle = document.getElementById("view-title");
const searchInput = document.getElementById("search");
const clearSearchButton = document.getElementById("clear-search");
const addFolderButton = document.getElementById("add-folder");
const newPromptButton = document.getElementById("new-prompt");
const navAllButton = document.querySelector('.nav-item[data-id="all"]');
const folderConfirmModal = document.getElementById("folder-confirm");
const cancelFolderDelete = document.getElementById("cancel-folder-delete");
const confirmFolderDelete = document.getElementById("confirm-folder-delete");
const promptConfirmModal = document.getElementById("prompt-confirm");
const cancelPromptDelete = document.getElementById("cancel-prompt-delete");
const confirmPromptDelete = document.getElementById("confirm-prompt-delete");

const promptModal = document.getElementById("prompt-modal");
const promptForm = document.getElementById("prompt-form");
const promptTitleInput = document.getElementById("prompt-title");
const promptContentInput = document.getElementById("prompt-content");
const promptFolderSelect = document.getElementById("prompt-folder");
const modalTitle = document.getElementById("modal-title");
const cancelModal = document.getElementById("cancel-modal");
const closeModal = document.getElementById("close-modal");
const deletePromptButton = document.getElementById("delete-prompt");
const savePromptButton = promptForm.querySelector('button[type="submit"]');

const mainContainer = document.querySelector(".main");
const listView = document.getElementById("list-view");
const editorView = document.getElementById("editor-view");
const editorBack = document.getElementById("editor-back");
const editorForm = document.getElementById("editor-form");
const editorTitleInput = document.getElementById("editor-prompt-title");
const editorContentInput = document.getElementById("editor-prompt-content");
const editorFolderSelect = document.getElementById("editor-prompt-folder");
const editorSaveButton = document.getElementById("editor-save");
const editorDeleteButton = document.getElementById("editor-delete");
const editorCopyButton = document.getElementById("editor-copy");
const editorHeading = document.querySelector(".editor-title");
const renameActiveButton = document.getElementById("rename-active-folder");
const topbarTitle = document.querySelector(".topbar-title");

const autosaveIndicator = document.querySelector(".autosave-msg"); // Revert to class selector or get by ID if ID is gone

// Remove unsavedModal vars

let callbacks = {};
let initialPromptSnapshot = null;
let renamingFolderId = null; // Track which folder is being renamed
let titleRenameContainer = null;
let titleRenameInput = null;
let pendingPromptDeleteAction = null;
// Remove isNewPromptMode

export function initUI(cbs) {
    callbacks = cbs;
    bindStaticEvents();
}

function bindStaticEvents() {
    searchInput.addEventListener("input", () => callbacks.onSearch(searchInput.value));
    searchInput.addEventListener("search", () => callbacks.onSearch(searchInput.value));
    clearSearchButton?.addEventListener("click", () => {
        searchInput.value = "";
        callbacks.onSearch("");
        searchInput.focus();
    });
    addFolderButton.addEventListener("click", showAddFolderForm);
    navAllButton.addEventListener("click", () => callbacks.onActivateFolder("all"));
    newPromptButton.addEventListener("click", () => {
        if (callbacks.onNewPrompt) {
            callbacks.onNewPrompt();
        } else {
            openPromptModal();
        }
    });
    cancelModal.addEventListener("click", hideModal);
    closeModal.addEventListener("click", hideModal);
    deletePromptButton.addEventListener("click", () => {
        if (!callbacks.onDeletePrompt) return;
        pendingPromptDeleteAction = callbacks.onDeletePrompt;
        showPromptConfirm();
    });
    promptForm.addEventListener("submit", handlePromptSubmit);
    promptModal.addEventListener("click", (event) => {
        if (event.target === promptModal) hideModal();
    });
    folderConfirmModal.addEventListener("click", (event) => {
        if (event.target === folderConfirmModal) hideFolderConfirm();
    });
    cancelFolderDelete.addEventListener("click", hideFolderConfirm);
    confirmFolderDelete.addEventListener("click", callbacks.onConfirmDeleteFolder);
    promptConfirmModal?.addEventListener("click", (event) => {
        if (event.target === promptConfirmModal) hidePromptConfirm();
    });
    cancelPromptDelete?.addEventListener("click", hidePromptConfirm);
    confirmPromptDelete?.addEventListener("click", () => {
        const action = pendingPromptDeleteAction;
        hidePromptConfirm();
        action?.();
    });

    promptFolderSelect.addEventListener("change", updateSaveState);

    editorBack?.addEventListener("click", () => {
        handleEditorSave();
        closeEditorView();
    });
    // Revert to simple autosave trigger
    editorForm?.addEventListener("input", triggerAutosave);
    editorFolderSelect?.addEventListener("change", triggerAutosave);
    editorDeleteButton?.addEventListener("click", () => {
        if (!callbacks.onEditorDelete) return;
        pendingPromptDeleteAction = callbacks.onEditorDelete;
        showPromptConfirm();
    });
    editorCopyButton?.addEventListener("click", callbacks.onEditorCopy);

    // Close custom selects when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".custom-select-container")) {
            document.querySelectorAll(".custom-select-container.open").forEach(el => el.classList.remove("open"));
        }
    });

    renameActiveButton?.addEventListener("click", () => {
        const id = renameActiveButton.dataset.id;
        if (!id) return;
        startRenaming(id);
    });
}

// Rendering
export function renderFolders(state, currentFolderId, editingPromptId) {
    folderList.innerHTML = "";
    const folders = getOrderedFolders(state);
    const activeFolder = state.folders.find((f) => f.id === currentFolderId);
    let isRenamingActive = !!renamingFolderId && activeFolder?.id === renamingFolderId;

    if (renamingFolderId && !isRenamingActive) {
        renamingFolderId = null;
        isRenamingActive = false;
    }

    folders.forEach((folder) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `folder ${folder.id === currentFolderId ? "active" : ""}`;
        item.dataset.id = folder.id;

        item.innerHTML = `
            <span class="folder-name">${escapeHtml(folder.name)}</span>
            <span class="folder-actions">
                <span class="delete-icon danger-text" title="Delete Folder">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path></svg>
                </span>
            </span>
        `;

        item.addEventListener("click", () => callbacks.onActivateFolder(folder.id));
        item.addEventListener("pointerdown", (e) => {
            if (e.target.closest(".folder-actions")) return;
            callbacks.onFolderPointerDown(e, folderList);
        });
        item.querySelector(".delete-icon").addEventListener("click", (e) => {
            e.stopPropagation();
            callbacks.onRequestDeleteFolder(folder.id);
        });

        folderList.appendChild(item);
    });

    updateTitleArea(activeFolder, isRenamingActive);
    renderFolderSelect(state, editingPromptId);
    setActiveNav(currentFolderId);
    syncFolderHeightToNav();
}

function updateTitleArea(activeFolder, isRenamingActive) {
    const name = activeFolder?.name || "All Prompts";

    if (isRenamingActive) {
        showTitleRename(name);
    } else {
        hideTitleRename();
        if (viewTitle) {
            viewTitle.textContent = name.toUpperCase();
        }
    }

    if (renameActiveButton) {
        const canRename = !!activeFolder && !activeFolder.locked && activeFolder.id !== "all";
        renameActiveButton.dataset.id = canRename ? activeFolder.id : "";
        renameActiveButton.dataset.name = canRename ? activeFolder.name : "";
        renameActiveButton.classList.toggle("hidden", !canRename || isRenamingActive);
        renameActiveButton.disabled = !canRename || isRenamingActive;
    }
}

function ensureTitleRenameUI() {
    if (titleRenameContainer || !topbarTitle) return;

    titleRenameContainer = document.createElement("div");
    titleRenameContainer.className = "title-rename hidden";
    titleRenameContainer.innerHTML = `
        <input type="text" class="title-rename-input" spellcheck="false" aria-label="Rename folder">
        <div class="title-rename-actions">
            <button class="folder-edit-btn save-rename" title="Save" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button class="folder-edit-btn cancel-rename" title="Cancel" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
    `;

    topbarTitle.insertBefore(titleRenameContainer, renameActiveButton || null);
    titleRenameInput = titleRenameContainer.querySelector(".title-rename-input");
    const saveBtn = titleRenameContainer.querySelector(".save-rename");
    const cancelBtn = titleRenameContainer.querySelector(".cancel-rename");

    const submit = () => handleRenameSave(renamingFolderId, titleRenameInput.value);

    titleRenameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            cancelRenaming();
        }
    });
    titleRenameInput.addEventListener("pointerdown", (e) => e.stopPropagation());
    titleRenameInput.addEventListener("click", (e) => e.stopPropagation());

    saveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        submit();
    });

    cancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        cancelRenaming();
    });
}

function focusTitleRenameInput() {
    if (!titleRenameInput || titleRenameContainer?.classList.contains("hidden")) return;
    titleRenameInput.focus();
    titleRenameInput.select();
}

function showTitleRename(currentName) {
    ensureTitleRenameUI();
    if (!titleRenameContainer || !titleRenameInput) return;
    if (viewTitle) {
        viewTitle.classList.add("hidden");
    }
    topbarTitle?.classList.add("renaming-title");
    titleRenameContainer.classList.remove("hidden");
    titleRenameInput.value = currentName || "";
    requestAnimationFrame(focusTitleRenameInput);
}

function hideTitleRename() {
    if (viewTitle) {
        viewTitle.classList.remove("hidden");
    }
    topbarTitle?.classList.remove("renaming-title");
    if (titleRenameContainer) {
        titleRenameContainer.classList.add("hidden");
    }
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function startRenaming(folderId) {
    renamingFolderId = folderId;
    callbacks.onRenameStart?.();
    requestAnimationFrame(() => {
        focusTitleRenameInput();
    });
}

function cancelRenaming() {
    renamingFolderId = null;
    callbacks.onRenameCancel?.();
}

function handleRenameSave(folderId, rawName) {
    const name = (rawName || "").trim();
    if (!name) {
        cancelRenaming();
        return;
    }
    renamingFolderId = null;
    callbacks.onRenameFolder?.(folderId, name);
}

function syncFolderHeightToNav() {
    const nav = document.querySelector('.nav-item[data-id="all"]') || document.querySelector('.nav-item');
    if (!nav) return;
    const { height } = nav.getBoundingClientRect();
    if (height > 0) {
        document.documentElement.style.setProperty("--folder-height", `${Math.round(height)}px`);
    }
}

function getOrderedFolders(state) {
    return state.folders
        .filter((f) => f.id !== "all")
        .sort((a, b) => {
            const orderA = Number.isFinite(a.order) ? a.order : 0;
            const orderB = Number.isFinite(b.order) ? b.order : 0;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
        });
}

export function renderPrompts(state, currentFolderId) {
    promptGrid.innerHTML = "";
    const query = searchInput.value.trim().toLowerCase();
    const visiblePrompts = state.prompts
        .filter((prompt) => {
            const matchesFolder = currentFolderId === "all" || prompt.folderId === currentFolderId;
            if (!matchesFolder) return false;
            if (!query) return true;
            return (
                (prompt.title || "").toLowerCase().includes(query) ||
                prompt.content.toLowerCase().includes(query)
            );
        })
        .sort((a, b) => {
            const orderA = Number.isFinite(a.order) ? a.order : 0;
            const orderB = Number.isFinite(b.order) ? b.order : 0;
            if (orderA !== orderB) return orderA - orderB;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

    if (visiblePrompts.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";

        const hasAnyPrompts = state.prompts.length > 0;
        const message = hasAnyPrompts
            ? "<div>No prompts found.</div>"
            : "<div>No prompts found.</div><div>Create one to get started.</div>";

        empty.innerHTML = `
      <div class="hint">${message}</div>
    `;

        promptGrid.appendChild(empty);
        return;
    }

    visiblePrompts.forEach((prompt) => {
        const card = document.createElement("article");
        card.className = "prompt-card";
        card.dataset.id = prompt.id;
        const updated = prompt.updatedAt
            ? new Date(prompt.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            })
            : "";
        const updatedLabel = updated ? `Last updated ${updated}` : "Last updated —";
        card.innerHTML = `
      <div class="prompt-actions">
        <button class="copy-chip" data-copy-id="${prompt.id}">Copy</button>
      </div>
      <h3 class="prompt-title">${prompt.title || "Untitled prompt"}</h3>
      <p class="prompt-body">${sanitize(prompt.content)}</p>
      <div class="prompt-meta">
        <span>${updatedLabel}</span>
      </div>
    `;

        // Handle copy button click locally to update UI immediately
        const copyBtn = card.querySelector(".copy-chip");
        copyBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent card click
            copyBtn.textContent = "COPIED";
            callbacks.onCopyPrompt(prompt.id, prompt.content);
        });

        promptGrid.appendChild(card);
        attachCardReset(card);
    });
}

function attachCardReset(card) {
    card.addEventListener("mouseleave", () => {
        const copyButton = card.querySelector(".copy-chip");
        if (copyButton) {
            copyButton.blur();
        }
    });
    card.addEventListener("mouseenter", () => {
        const copyButton = card.querySelector(".copy-chip");
        if (copyButton) {
            copyButton.textContent = "Copy";
        }
    });
}

export function renderFolderSelect(state, editingPromptId) {
    promptFolderSelect.innerHTML = "";
    editorFolderSelect.innerHTML = "";
    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "No folder";
    promptFolderSelect.appendChild(noneOption);
    editorFolderSelect.appendChild(noneOption.cloneNode(true));
    const options = state.folders.filter((f) => f.id !== "all");
    options.forEach((folder) => {
        const opt = document.createElement("option");
        opt.value = folder.id;
        opt.textContent = folder.name;
        promptFolderSelect.appendChild(opt);
        editorFolderSelect.appendChild(opt.cloneNode(true));
    });

    const activePrompt = editingPromptId
        ? state.prompts.find((p) => p.id === editingPromptId)
        : null;
    const targetFolderId = activePrompt?.folderId || "";
    if (editorFolderSelect) {
        editorFolderSelect.value = targetFolderId;
    }

    updateCustomSelect(promptFolderSelect);
    updateCustomSelect(editorFolderSelect);
}

function setupCustomSelect(nativeSelect) {
    if (nativeSelect.classList.contains("replaced-by-custom")) return;

    // Create container
    const container = document.createElement("div");
    container.className = "custom-select-container";

    // Create trigger
    const trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";
    trigger.tabIndex = 0;
    trigger.innerHTML = `
        <span class="selected-text"></span>
        <span class="arrow"></span>
    `;

    // Create options container
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "custom-select-options";

    // Create search input
    const searchContainer = document.createElement("div");
    searchContainer.className = "custom-select-search";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search...";
    searchInput.addEventListener("click", (e) => e.stopPropagation());
    searchContainer.appendChild(searchInput);
    optionsContainer.appendChild(searchContainer);

    // Create list container
    const listContainer = document.createElement("div");
    listContainer.className = "custom-select-list";
    optionsContainer.appendChild(listContainer);

    // Insert container before select
    nativeSelect.parentNode.insertBefore(container, nativeSelect);

    // Move select into container
    container.appendChild(nativeSelect);
    container.appendChild(trigger);
    container.appendChild(optionsContainer);

    nativeSelect.classList.add("replaced-by-custom");

    // Event listeners
    trigger.addEventListener("click", (e) => {
        // Close other selects
        document.querySelectorAll(".custom-select-container.open").forEach(el => {
            if (el !== container) el.classList.remove("open");
        });
        container.classList.toggle("open");
        if (container.classList.contains("open")) {
            searchInput.value = "";
            filterOptions(listContainer, "");
            searchInput.focus();
            highlightOption(listContainer, nativeSelect.value);
        }
        e.stopPropagation();
    });

    trigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            trigger.click();
        }
    });

    searchInput.addEventListener("input", () => {
        filterOptions(listContainer, searchInput.value);
        // Highlight first visible option
        const visible = Array.from(listContainer.querySelectorAll(".custom-option:not(.hidden)"));
        if (visible.length > 0) {
            setHighlight(listContainer, visible[0]);
        }
    });

    searchInput.addEventListener("keydown", (e) => {
        const visibleOptions = Array.from(listContainer.querySelectorAll(".custom-option:not(.hidden)"));
        const currentIndex = visibleOptions.findIndex(opt => opt.classList.contains("highlighted"));

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextIndex = (currentIndex + 1) % visibleOptions.length;
            setHighlight(listContainer, visibleOptions[nextIndex]);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevIndex = (currentIndex - 1 + visibleOptions.length) % visibleOptions.length;
            setHighlight(listContainer, visibleOptions[prevIndex]);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (currentIndex >= 0) {
                visibleOptions[currentIndex].click();
            }
        } else if (e.key === "Escape") {
            container.classList.remove("open");
            trigger.focus();
        }
    });
}

function filterOptions(container, query) {
    const options = container.querySelectorAll(".custom-option");
    const q = query.toLowerCase();
    options.forEach(opt => {
        const match = opt.textContent.toLowerCase().includes(q);
        opt.classList.toggle("hidden", !match);
    });
}

function setHighlight(container, option) {
    container.querySelectorAll(".custom-option").forEach(opt => opt.classList.remove("highlighted"));
    if (option) {
        option.classList.add("highlighted");
        option.scrollIntoView({ block: "nearest" });
    }
}

function highlightOption(container, value) {
    const option = Array.from(container.querySelectorAll(".custom-option")).find(opt => opt.dataset.value === value);
    setHighlight(container, option);
}

function updateCustomSelect(nativeSelect) {
    if (!nativeSelect) return;
    let container = nativeSelect.closest(".custom-select-container");
    if (!container) {
        setupCustomSelect(nativeSelect);
        container = nativeSelect.closest(".custom-select-container");
    }

    const triggerText = container.querySelector(".selected-text");
    const listContainer = container.querySelector(".custom-select-list");
    // const optionsContainer = container.querySelector(".custom-select-options"); // Not directly used for options manipulation here

    // Update trigger text
    const selectedOption = nativeSelect.options[nativeSelect.selectedIndex];
    triggerText.textContent = selectedOption ? selectedOption.textContent : "";

    // Rebuild options
    if (listContainer) {
        listContainer.innerHTML = "";
        Array.from(nativeSelect.options).forEach((opt) => {
            const customOpt = document.createElement("div");
            customOpt.className = "custom-option";
            if (opt.selected) customOpt.classList.add("selected");
            customOpt.textContent = opt.textContent;
            customOpt.dataset.value = opt.value;

            customOpt.addEventListener("click", (e) => {
                nativeSelect.value = opt.value;
                // Dispatch change event
                nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
                // Update UI
                triggerText.textContent = opt.textContent;
                container.classList.remove("open");

                // Update selected class
                listContainer.querySelectorAll(".custom-option").forEach(el => el.classList.remove("selected"));
                customOpt.classList.add("selected");
                e.stopPropagation();
            });

            listContainer.appendChild(customOpt);
        });
    }
}

function setActiveNav(currentFolderId) {
    const isAll = currentFolderId === "all";
    navAllButton.classList.toggle("active", isAll);
}

// Modals & Forms
export function showAddFolderForm() {
    if (document.querySelector(".add-folder-panel")) return;
    const panel = document.createElement("div");
    panel.className = "add-folder-panel";
    panel.innerHTML = `
    <input class="add-folder-input" type="text" placeholder="Folder Name" maxlength="120" />
    <div class="add-folder-actions">
      <button type="button" class="add-folder-submit">Add</button>
      <button type="button" class="add-folder-cancel ghost">Cancel</button>
    </div>
  `;
    addFolderButton.classList.add("hidden");
    addFolderButton.insertAdjacentElement("afterend", panel);

    const input = panel.querySelector(".add-folder-input");
    const submitBtn = panel.querySelector(".add-folder-submit");
    const cancelBtn = panel.querySelector(".add-folder-cancel");

    const submit = () => {
        const name = input.value.trim();
        if (!name) return;
        callbacks.onCreateFolder(name);
        hideAddFolderForm();
    };

    submitBtn?.addEventListener("click", submit);
    cancelBtn?.addEventListener("click", hideAddFolderForm);
    input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            submit();
        } else if (event.key === "Escape") {
            event.preventDefault();
            hideAddFolderForm();
        }
    });

    input?.focus();
}

export function hideAddFolderForm() {
    const panel = document.querySelector(".add-folder-panel");
    if (panel) panel.remove();
    addFolderButton.classList.remove("hidden");
}

export function openPromptModal(prompt, currentFolderId, folders) {
    promptModal.classList.remove("hidden");
    modalTitle.textContent = prompt ? "Edit Prompt" : "New Prompt";
    deletePromptButton.classList.toggle("hidden", !prompt);
    promptTitleInput.value = prompt?.title || "";
    promptContentInput.value = prompt?.content || "";
    promptFolderSelect.value =
        folders.find((f) => f.id === currentFolderId && f.id !== "all")?.id ||
        "";
    updateCustomSelect(promptFolderSelect);
    initialPromptSnapshot = captureSnapshot();
    updateSaveState();
}

export function hideModal() {
    promptModal.classList.add("hidden");
    promptForm.reset();
    initialPromptSnapshot = null;
    callbacks.onModalClose();
}

export function openEditorView(prompt) {
    editorHeading.textContent = "Edit Prompt";
    editorTitleInput.value = prompt.title || "";
    editorContentInput.value = prompt.content || "";
    editorFolderSelect.value = prompt.folderId || "";
    updateCustomSelect(editorFolderSelect);

    // isNewPromptMode = false; // logic removed
    // editorSaveButton removed
    if (autosaveIndicator) autosaveIndicator.classList.remove("hidden");

    editorDeleteButton.classList.remove("hidden");
    editorDeleteButton.disabled = false;
    editorCopyButton.classList.remove("hidden");
    editorCopyButton.disabled = false;
    showEditorSurface();
    initialPromptSnapshot = null;
}

export function openNewPromptView(currentFolderId, folders = []) {
    if (editorHeading) editorHeading.textContent = "New Prompt";
    editorForm.reset();
    editorTitleInput.value = "";
    editorContentInput.value = "";
    const defaultFolderId =
        folders.find((f) => f.id === currentFolderId && f.id !== "all")?.id || "";
    editorFolderSelect.value = defaultFolderId;
    updateCustomSelect(editorFolderSelect);

    // isNewPromptMode = true; // logic removed
    // save button logic removed
    if (autosaveIndicator) autosaveIndicator.classList.remove("hidden"); // Autosave IS active

    editorDeleteButton.classList.add("hidden");
    editorCopyButton.classList.add("hidden");
    showEditorSurface();

    initialPromptSnapshot = null; // No snapshot needed for modal
}

export function closeEditorView() {
    initialPromptSnapshot = null;
    editorForm.reset();
    editorView?.classList.add("hidden");
    listView?.classList.remove("hidden");
    mainContainer?.classList.remove("editing");
    callbacks.onEditorClose();
}

export function showFolderConfirm() {
    folderConfirmModal.classList.remove("hidden");
}

export function hideFolderConfirm() {
    folderConfirmModal.classList.add("hidden");
    callbacks.onFolderConfirmClose();
}

export function showPromptConfirm() {
    promptConfirmModal?.classList.remove("hidden");
}

export function hidePromptConfirm() {
    promptConfirmModal?.classList.add("hidden");
    pendingPromptDeleteAction = null;
}

// remove hasUnsavedChanges

function showEditorSurface() {
    listView?.classList.add("hidden");
    editorView?.classList.remove("hidden");
    mainContainer?.classList.add("editing");
}


function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const triggerAutosave = debounce(() => {
    handleEditorSave();
}, 800);

// remove updateEditorSaveState

// Form Handling
function captureSnapshot() {
    return {
        title: promptTitleInput.value.trim(),
        content: promptContentInput.value.trim(),
        folderId: promptFolderSelect.value || "",
    };
}

function updateSaveState() {
    if (!savePromptButton) return;
    const snapshot = captureSnapshot();
    const changed =
        !initialPromptSnapshot ||
        snapshot.title !== initialPromptSnapshot.title ||
        snapshot.content !== initialPromptSnapshot.content ||
        snapshot.folderId !== initialPromptSnapshot.folderId;
    const hasContent = snapshot.content.length > 0;
    savePromptButton.disabled = !(changed && hasContent);
}

function handlePromptSubmit(event) {
    event.preventDefault();
    if (savePromptButton?.disabled) return;
    const title = promptTitleInput.value.trim();
    const content = promptContentInput.value.trim();
    const folderId = promptFolderSelect.value;
    if (!content) return;
    callbacks.onPromptSubmit({ title, content, folderId });
}

function captureEditorSnapshot() {
    return {
        title: editorTitleInput.value.trim(),
        content: editorContentInput.value.trim(),
        folderId: editorFolderSelect.value || "",
    };
}

function handleEditorSave() {
    const title = editorTitleInput.value.trim();
    const content = editorContentInput.value.trim();
    const folderId = editorFolderSelect.value;

    // User requested: if no content, don't create new prompt.
    // If it's empty content for existing prompt, we allow saving empty? 
    // Or normally we require content. The previous code check `if (!content) return` prevents empty saves.
    if (!content) return;

    callbacks.onEditorSave({ title, content, folderId });
}

export function promoteEditorToExisting(prompt) {
    // Keep UI in "new" state until user navigates back and reopens; buttons stay hidden for this session.
}

export function updateCopyButton(id, text) {
    const card = promptGrid.querySelector(`.prompt-card[data-id="${id}"]`);
    const copyButton = card?.querySelector(".copy-chip");
    if (copyButton) {
        copyButton.textContent = text;
    }
}
