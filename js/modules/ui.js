import { sanitize } from "./dom.js";

// DOM Elements
export const folderList = document.getElementById("folder-list");
export const promptGrid = document.getElementById("prompt-grid");
const viewTitle = document.getElementById("view-title");
const searchInput = document.getElementById("search");
const addFolderButton = document.getElementById("add-folder");
const newPromptButton = document.getElementById("new-prompt");
const navAllButton = document.querySelector('.nav-item[data-id="all"]');
const folderConfirmModal = document.getElementById("folder-confirm");
const cancelFolderDelete = document.getElementById("cancel-folder-delete");
const confirmFolderDelete = document.getElementById("confirm-folder-delete");

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

let callbacks = {};
let initialPromptSnapshot = null;
let editorSnapshot = null;

export function initUI(cbs) {
    callbacks = cbs;
    bindStaticEvents();
}

function bindStaticEvents() {
    searchInput.addEventListener("input", () => callbacks.onSearch(searchInput.value));
    addFolderButton.addEventListener("click", showAddFolderForm);
    navAllButton.addEventListener("click", () => callbacks.onActivateFolder("all"));
    newPromptButton.addEventListener("click", () => openPromptModal());
    cancelModal.addEventListener("click", hideModal);
    closeModal.addEventListener("click", hideModal);
    deletePromptButton.addEventListener("click", () => callbacks.onDeletePrompt());
    promptForm.addEventListener("submit", handlePromptSubmit);
    cancelFolderDelete.addEventListener("click", hideFolderConfirm);
    confirmFolderDelete.addEventListener("click", callbacks.onConfirmDeleteFolder);

    promptTitleInput.addEventListener("input", updateSaveState);
    promptContentInput.addEventListener("input", updateSaveState);
    promptFolderSelect.addEventListener("change", updateSaveState);

    editorBack?.addEventListener("click", closeEditorView);
    editorForm?.addEventListener("input", updateEditorSaveState);
    editorForm?.addEventListener("change", updateEditorSaveState);
    editorSaveButton?.addEventListener("click", handleEditorSave);
    editorDeleteButton?.addEventListener("click", callbacks.onEditorDelete);
    editorCopyButton?.addEventListener("click", callbacks.onEditorCopy);
}

// Rendering
export function renderFolders(state, currentFolderId) {
    folderList.innerHTML = "";
    const folders = getOrderedFolders(state);

    folders.forEach((folder) => {
        const button = document.createElement("div");
        button.className = `folder${folder.id === currentFolderId ? " active" : ""}`;
        button.dataset.id = folder.id;
        button.setAttribute("role", "button");
        button.setAttribute("tabindex", "0");
        button.setAttribute("draggable", "false");
        button.draggable = false;
        button.innerHTML = `
      <span class="folder-name">${folder.name}</span>
      <button class="trash" type="button" data-folder-delete="${folder.id}" aria-label="Delete folder">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M10 10v7" />
          <path d="M14 10v7" />
          <path d="M5 6l1 14h12l1-14" />
        </svg>
      </button>
    `;
        button.addEventListener("click", (event) => {
            if (callbacks.isDraggingFolder()) return;
            const target = event.target;
            if (target instanceof HTMLElement && target.closest("[data-folder-delete]")) return;
            callbacks.onActivateFolder(folder.id);
        });
        const trashBtn = button.querySelector("[data-folder-delete]");
        trashBtn?.setAttribute("draggable", "false");
        trashBtn?.addEventListener("click", (event) => {
            event.stopPropagation();
            callbacks.onRequestDeleteFolder(folder.id);
        });
        button.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                callbacks.onActivateFolder(folder.id);
            }
        });

        // Drag events are attached in options.js or via delegation, but here we need to attach pointerdown
        button.addEventListener("pointerdown", (e) => callbacks.onFolderPointerDown(e, folderList));

        folderList.appendChild(button);
    });

    viewTitle.textContent =
        (folders.find((f) => f.id === currentFolderId)?.name || "All Prompts").toUpperCase();
    renderFolderSelect(state);
    setActiveNav(currentFolderId);
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
        prompt?.folderId ||
        folders.find((f) => f.id === currentFolderId && f.id !== "all")?.id ||
        "";
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
    if (editorHeading) editorHeading.textContent = "Edit Prompt";
    editorTitleInput.value = prompt.title || "";
    editorContentInput.value = prompt.content || "";
    editorFolderSelect.value = prompt.folderId || "";
    editorSnapshot = captureEditorSnapshot();
    updateEditorSaveState();
    listView?.classList.add("hidden");
    editorView?.classList.remove("hidden");
    editorDeleteButton.disabled = false;
    editorCopyButton.disabled = false;
    mainContainer?.classList.add("editing");
}

export function closeEditorView() {
    editorSnapshot = null;
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

function updateEditorSaveState() {
    if (!editorSaveButton) return;
    const snapshot = captureEditorSnapshot();
    const changed =
        !editorSnapshot ||
        snapshot.title !== editorSnapshot.title ||
        snapshot.content !== editorSnapshot.content ||
        snapshot.folderId !== editorSnapshot.folderId;
    const hasContent = snapshot.content.length > 0;
    editorSaveButton.disabled = !(changed && hasContent);
}

function handleEditorSave(event) {
    event.preventDefault();
    if (editorSaveButton.disabled) return;
    const title = editorTitleInput.value.trim();
    const content = editorContentInput.value.trim();
    const folderId = editorFolderSelect.value;
    if (!content) return;
    callbacks.onEditorSave({ title, content, folderId });
}

export function updateCopyButton(id, text) {
    const card = promptGrid.querySelector(`.prompt-card[data-id="${id}"]`);
    const copyButton = card?.querySelector(".copy-chip");
    if (copyButton) {
        copyButton.textContent = text;
    }
}
