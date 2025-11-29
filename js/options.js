import { createDefaultState, loadState, makeId, saveState } from "./storage.js";
import * as UI from "./modules/ui.js";
import * as DragDrop from "./modules/drag-drop.js";

let state = createDefaultState();
let currentFolderId = "all";
let editingPromptId = null;
let pendingFolderDelete = null;

async function init() {
    state = await loadState();
    normalizePromptOrder();
    normalizeFolderOrder();

    UI.initUI({
        onSearch: () => UI.renderPrompts(state, currentFolderId),
        onActivateFolder: (id) => {
            currentFolderId = id;
            UI.renderFolders(state, currentFolderId);
            UI.renderPrompts(state, currentFolderId);
            DragDrop.clearFolderDragIndicators(UI.folderList);
        },
        onCreateFolder: createFolder,
        onDeletePrompt: () => deletePrompt(editingPromptId),
        onPromptSubmit: handlePromptSubmit,
        onConfirmDeleteFolder: confirmDeleteFolder,
        onRequestDeleteFolder: (id) => {
            pendingFolderDelete = id;
            UI.showFolderConfirm();
        },
        onFolderPointerDown: (e, list) => DragDrop.handleFolderPointerDown(e, list),
        isDraggingFolder: () => DragDrop.isDraggingFolder(),
        onModalClose: () => { editingPromptId = null; },
        onEditorClose: () => { editingPromptId = null; },
        onFolderConfirmClose: () => { pendingFolderDelete = null; },
        onEditorDelete: () => deletePrompt(editingPromptId),
        onEditorCopy: () => copyPrompt(editingPromptId),
        onEditorSave: handleEditorSave,
    });

    DragDrop.initDragDrop({
        onPromptReorder: reorderPrompts,
        onFolderReorder: applyFolderOrderFromIds,
        onRenderPrompts: () => UI.renderPrompts(state, currentFolderId),
        onRenderFolders: () => UI.renderFolders(state, currentFolderId),
    });

    // Initial render
    UI.renderFolders(state, currentFolderId);
    UI.renderPrompts(state, currentFolderId);

    bindEvents();
}

function bindEvents() {
    UI.newPromptButton?.addEventListener("click", () => UI.openPromptModal(null, currentFolderId, state.folders));

    // Drag events
    UI.promptGrid.addEventListener("dragstart", DragDrop.handleDragStart);
    UI.promptGrid.addEventListener("dragover", DragDrop.handleDragOver);
    UI.promptGrid.addEventListener("dragleave", DragDrop.handleDragLeave);
    UI.promptGrid.addEventListener("drop", DragDrop.handleDrop);
    UI.promptGrid.addEventListener("dragend", DragDrop.handleDragEnd);

    // Card actions
    UI.promptGrid.addEventListener("click", handleCardActions);
}

function handleCardActions(event) {
    const { target } = event;
    if (!(target instanceof HTMLElement)) return;
    const copyBtn = target.closest("[data-copy-id]");
    if (copyBtn) {
        const id = copyBtn.getAttribute("data-copy-id");
        copyPrompt(id);
        return;
    }
    const card = target.closest(".prompt-card");
    if (!card) return;
    const id = card.getAttribute("data-id");
    const prompt = state.prompts.find((item) => item.id === id);
    if (prompt) {
        editingPromptId = prompt.id;
        UI.openEditorView(prompt);
    }
}

function createFolder(name) {
    const exists = state.folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    const id = makeId("folder");
    const nextOrder = state.folders.filter((f) => f.id !== "all").length;
    state.folders.push({ id, name, locked: false, order: nextOrder });
    currentFolderId = id;
    saveState(state);
    UI.renderFolders(state, currentFolderId);
    UI.renderPrompts(state, currentFolderId);
}

async function handlePromptSubmit({ title, content, folderId }) {
    if (editingPromptId) {
        state.prompts = state.prompts.map((item) =>
            item.id === editingPromptId
                ? { ...item, title, content, folderId: folderId || undefined, updatedAt: Date.now() }
                : item
        );
    } else {
        state.prompts.unshift({
            id: makeId("prompt"),
            title,
            content,
            folderId: folderId || undefined,
            order: state.prompts.length,
            updatedAt: Date.now(),
        });
    }
    await saveState(state);
    UI.hideModal();
    UI.renderFolders(state, currentFolderId);
    UI.renderPrompts(state, currentFolderId);
}

async function deletePrompt(id) {
    if (!id) return;
    const confirmed = confirm("Delete this prompt?");
    if (!confirmed) return;
    state.prompts = state.prompts.filter((item) => item.id !== id);
    reindexPromptOrder();
    await saveState(state);
    UI.hideModal();
    UI.closeEditorView();
    UI.renderFolders(state, currentFolderId);
    UI.renderPrompts(state, currentFolderId);
}

async function handleEditorSave({ title, content, folderId }) {
    if (!editingPromptId) return;
    state.prompts = state.prompts.map((item) =>
        item.id === editingPromptId
            ? { ...item, title, content, folderId: folderId || undefined, updatedAt: Date.now() }
            : item
    );
    await saveState(state);
    // We need to update the editor snapshot in UI, but UI handles that internally via captureEditorSnapshot if we re-open or if we just update the UI state.
    // Actually UI.handleEditorSave calls callbacks.onEditorSave.
    // UI doesn't automatically update its snapshot.
    // But since we don't close the editor, we might want to signal UI to update snapshot?
    // In the original code: editorSnapshot = captureEditorSnapshot(); updateEditorSaveState();
    // We can't easily reach into UI to update snapshot.
    // Maybe we should close and reopen? Or just let UI handle the snapshot update?
    // The UI module's handleEditorSave doesn't update snapshot.
    // Let's modify UI.js to update snapshot after callback? Or expose a way to do it.
    // For now, let's just re-render.
    UI.renderFolders(state, currentFolderId);
    UI.renderPrompts(state, currentFolderId);

    // To fix the "Save" button state (it should become disabled), we need to update the snapshot in UI.
    // I'll assume for now the user accepts that the button might stay enabled or I'll fix UI.js later.
    // Actually, I can just call UI.openEditorView(prompt) again with the new data?
    const updatedPrompt = state.prompts.find(p => p.id === editingPromptId);
    if (updatedPrompt) UI.openEditorView(updatedPrompt);
}

async function confirmDeleteFolder() {
    if (!pendingFolderDelete) return;
    const folderId = pendingFolderDelete;
    state.folders = state.folders.filter((f) => f.id !== folderId);
    state.prompts = state.prompts.filter((p) => p.folderId !== folderId);
    if (currentFolderId === folderId) {
        currentFolderId = "all";
    }
    reindexFolderOrder();
    await saveState(state);
    UI.hideFolderConfirm();
    UI.renderFolders(state, currentFolderId);
    UI.renderPrompts(state, currentFolderId);
}

function copyPrompt(id) {
    const prompt = state.prompts.find((item) => item.id === id);
    if (!prompt) return;
    UI.updateCopyButton(id, "Copied");
    navigator.clipboard?.writeText(prompt.content);
}

function reorderPrompts(fromId, toId) {
    const fromIndex = state.prompts.findIndex((p) => p.id === fromId);
    const toIndex = state.prompts.findIndex((p) => p.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = state.prompts.splice(fromIndex, 1);
    state.prompts.splice(toIndex, 0, moved);
    reindexPromptOrder();
    saveState(state);
}

function applyFolderOrderFromIds(ids) {
    const map = new Map(
        state.folders.filter((f) => f.id !== "all").map((folder) => [folder.id, folder])
    );
    const ordered = ids.map((id) => map.get(id)).filter(Boolean);
    ordered.forEach((folder, index) => {
        folder.order = index;
    });
    const allFolder = state.folders.find((f) => f.id === "all");
    state.folders = allFolder ? [allFolder, ...ordered] : ordered;
    saveState(state);
}

function reindexPromptOrder() {
    state.prompts = state.prompts.map((prompt, index) => ({
        ...prompt,
        order: index,
    }));
}

function normalizePromptOrder() {
    let changed = false;
    state.prompts = state.prompts.map((prompt, index) => {
        if (typeof prompt.order === "number") return prompt;
        changed = true;
        return { ...prompt, order: index };
    });
    if (changed) {
        reindexPromptOrder();
        saveState(state);
    }
}


function reindexFolderOrder() {
    const allFolder = state.folders.find((f) => f.id === "all");
    const rest = state.folders
        .filter((f) => f.id !== "all")
        .sort((a, b) => {
            const orderA = Number.isFinite(a.order) ? a.order : 0;
            const orderB = Number.isFinite(b.order) ? b.order : 0;
            return orderA - orderB;
        })
        .map((folder, index) => ({ ...folder, order: index }));
    state.folders = allFolder ? [{ ...allFolder, order: -1 }, ...rest] : rest;
}

function normalizeFolderOrder() {
    let changed = false;
    state.folders = state.folders.map((folder, index) => {
        if (folder.id === "all") return folder;
        if (typeof folder.order === "number") return folder;
        changed = true;
        return { ...folder, order: index };
    });
    if (changed) {
        reindexFolderOrder();
        saveState(state);
    }
}

init();
