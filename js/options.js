import { createDefaultState, loadState, makeId, saveState } from "./storage.js";
import * as UI from "./modules/ui.js";
import * as DragDrop from "./modules/drag-drop.js";

let state = createDefaultState();
let currentFolderId = "all";
let editingPromptId = null;
let pendingFolderDelete = null;
let isCreatingNew = false;

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
        onModalClose: () => { editingPromptId = null; isCreatingNew = false; },
        onEditorClose: () => { editingPromptId = null; isCreatingNew = false; },
        onFolderConfirmClose: () => { pendingFolderDelete = null; },
        onEditorDelete: () => deletePrompt(editingPromptId),
        onEditorCopy: () => copyPrompt(editingPromptId),
        onEditorSave: handleEditorSave,
        onCopyPrompt: (id) => copyPrompt(id),
        onNewPrompt: startNewPrompt,
    });

    DragDrop.initDragDrop({
        onPromptReorder: reorderPromptsFromIds,
        onFolderReorder: applyFolderOrderFromIds,
        onRenderPrompts: () => UI.renderPrompts(state, currentFolderId),
        onRenderFolders: () => UI.renderFolders(state, currentFolderId),
        onPromptClick: (id) => {
            const prompt = state.prompts.find((item) => item.id === id);
            if (prompt) {
                editingPromptId = prompt.id;
                isCreatingNew = false;
                UI.openEditorView(prompt);
            }
        }
    });

    // Initial render
    UI.renderFolders(state, currentFolderId);
    UI.renderPrompts(state, currentFolderId);

    initAutoScrollbars();

    // Check for deep links
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("action") === "new") {
        startNewPrompt();
    }

    const exportBtn = document.getElementById("export-prompts");
    if (exportBtn) {
        exportBtn.addEventListener("click", exportPrompts);
    }

    bindEvents();
}

function bindEvents() {
    // Drag events
    // UI.promptGrid.addEventListener("dragstart", DragDrop.handleDragStart);
    // UI.promptGrid.addEventListener("dragover", DragDrop.handleDragOver);
    // UI.promptGrid.addEventListener("dragleave", DragDrop.handleDragLeave);
    // UI.promptGrid.addEventListener("drop", DragDrop.handleDrop);
    // UI.promptGrid.addEventListener("dragend", DragDrop.handleDragEnd);

    // New Pointer Drag events
    UI.promptGrid.addEventListener("pointerdown", (e) => DragDrop.handlePromptPointerDown(e, UI.promptGrid));

    // Card actions
    // UI.promptGrid.addEventListener("click", handleCardActions);
}

function startNewPrompt() {
    editingPromptId = null;
    isCreatingNew = true;
    UI.openNewPromptView(currentFolderId, state.folders);
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

    // Check if we are dragging (or just finished) to avoid opening editor on drop
    if (DragDrop.isDraggingFolder() || DragDrop.isDraggingPrompt()) return;

    // Actually, the click event might fire after pointerup.
    // In drag-drop.js we didn't prevent default on pointerdown, so click fires.
    // But if we moved, we should prevent click action.
    // We can check a flag in DragDrop module?
    // Let's add isDraggingPrompt to DragDrop module or similar.
    // For now, let's assume if it was a drag, the click might still fire?
    // Usually if we move enough, we might want to suppress click.
    // In handlePromptPointerUp we didn't prevent default click.
    // Let's see.

    const id = card.getAttribute("data-id");
    const prompt = state.prompts.find((item) => item.id === id);
    if (prompt) {
        editingPromptId = prompt.id;
        isCreatingNew = false;
        UI.openEditorView(prompt);
    }
    // Click on card body is now handled by DragDrop module via onPromptClick
}

// ... (rest of functions)

function reorderPromptsFromIds(ids) {
    // ids is array of prompt IDs in the new order (for the current folder view)
    // We need to update state.prompts to reflect this order.
    // But state.prompts contains ALL prompts (including other folders).
    // So we should only reorder the subset that is currently visible, 
    // and keep others in their relative positions? 
    // Or simpler: just update the 'order' field for the visible prompts based on the new index.

    const map = new Map(state.prompts.map(p => [p.id, p]));
    const currentFolderPrompts = ids.map(id => map.get(id)).filter(Boolean);

    // Update order for these prompts
    // We need to know what range of 'order' values they occupied?
    // Or just re-assign order based on visual index?
    // If we use a global order, we can just assign them new order values.
    // But we need to make sure we don't conflict with other folders?
    // The current implementation uses a global 'order' field.
    // renderPrompts sorts by 'order'.

    // Strategy:
    // 1. Get all prompts for current folder.
    // 2. Sort them by current order (to know the "slots" they occupy).
    // 3. Assign the new order based on the 'ids' array to these slots?
    // Actually, simpler: just give them order = index, but that might mess up interleaving with other folders if we view "All"?
    // If "All" view, then we are reordering everything.
    // If specific folder view, we are reordering just that folder.
    // If we change order in specific folder, how does it affect "All"?
    // Usually "All" just shows everything sorted by order.
    // So if we reorder in a folder, we just want them to be in that relative order.
    // We can just assign them order values.
    // To avoid conflicts or shifting everything, maybe we can just use floating point orders?
    // Or just re-normalize everything.

    // Let's try to keep it simple:
    // If we are in "All", we just re-index everything based on `ids`.
    // If we are in a specific folder, we only have `ids` for that folder.
    // We should probably re-index the whole state.prompts list?
    // But we don't know where the other folder items fit in.

    // Better approach:
    // We have `ids` which is the new order for the *visible* prompts.
    // We want to update `state.prompts` such that when filtered and sorted, it matches `ids`.
    // We can take the set of prompts involved, and re-assign their 'order' property 
    // to be sequential, but we need to respect the 'order' of prompts NOT in this view.

    // Actually, if we are in a folder, the user only sees that folder.
    // They expect the order they see to be saved.
    // We can just assign them order = 0, 1, 2... relative to each other?
    // But we need a global sort order.

    // Let's just update the `order` property of the moved items.
    // But `ids` gives us the full new sequence of the visible items.
    // We can just iterate `ids` and set `prompt.order = index`.
    // But what about prompts in other folders? They might have order=0, 1, 2... too.
    // If we use a single global list, we need unique orders.
    // `normalizePromptOrder` ensures unique orders (0 to N).

    // So:
    // 1. Extract all prompts that are NOT in the current view (if any).
    // 2. Combine them with the new ordered list from `ids`.
    // 3. Re-index everything.

    // Wait, if we are in "All", `ids` has everything.
    // If we are in "Folder A", `ids` has only Folder A prompts.
    // Prompts in "Folder B" are not in `ids`.
    // We should preserve the relative order of Folder B prompts vs Folder A prompts?
    // Or does it matter?
    // If I move item X in Folder A to position 0, it should be order 0.
    // If item Y in Folder B was order 0, now we have conflict?
    // `renderPrompts` sorts by order.

    // Let's just re-index the *visible* prompts to have orders that reflect their new visual sequence,
    // but we need to fit them into the global sequence.
    // This is complicated if we want to preserve "All" view order perfectly mixed.
    // But maybe we don't care about "All" view order mixing?
    // Usually "All" view just shows everything.

    // Let's assume we just re-index the *entire* list based on:
    // 1. Prompts in `ids` come first (or in their new relative order).
    // 2. Prompts not in `ids` come after? Or before?
    // This seems wrong if we are just reordering a sub-folder.

    // Alternative:
    // Just update the `order` of the items in `ids` to be spaced out?
    // Or:
    // 1. Get the list of ALL prompts sorted by current order.
    // 2. Remove the prompts that are in `ids`.
    // 3. Insert the prompts from `ids` back into the list?
    // Where?
    // Maybe at the index of the first item from `ids`?
    // This preserves the "block" of the folder.

    const allPrompts = [...state.prompts].sort((a, b) => a.order - b.order);
    const visibleIdsSet = new Set(ids);
    const nonVisiblePrompts = allPrompts.filter(p => !visibleIdsSet.has(p.id));

    // If we are in "All", nonVisiblePrompts is empty (mostly).
    // If we are in a folder, nonVisiblePrompts are other folders' prompts.

    // We want to keep nonVisiblePrompts where they are, and put `ids` prompts... where?
    // If we treat the visible prompts as a contiguous block in the global order, it's easy.
    // But they might be scattered.

    // Let's try this:
    // We map the new `ids` to the *original indices* of the visible prompts in the sorted global list.
    // e.g. visible prompts were at global indices [2, 5, 9].
    // We take the new `ids` and place them into [2, 5, 9] in that order.
    // This preserves the "slots" used by this folder.

    const sortedPrompts = state.prompts.sort((a, b) => a.order - b.order);
    const visibleIndices = [];
    sortedPrompts.forEach((p, index) => {
        if (visibleIdsSet.has(p.id)) {
            visibleIndices.push(index);
        }
    });

    // Now we have the slots.
    // We place the prompts from `ids` into these slots.
    ids.forEach((id, i) => {
        const prompt = state.prompts.find(p => p.id === id);
        if (prompt) {
            // We can't just set order = visibleIndices[i] because we might need to re-normalize later.
            // But effectively we want them to take these relative positions.
            // We can just reconstruct the global list.
            // But wait, `state.prompts` is the source of truth.
            // We can assign a temporary `newOrder` property.
        }
    });

    // Reconstruct the new global order array
    const newOrderArray = new Array(sortedPrompts.length).fill(null);

    // Fill in non-visible
    sortedPrompts.forEach((p, index) => {
        if (!visibleIdsSet.has(p.id)) {
            newOrderArray[index] = p;
        }
    });

    // Fill in visible in their new order into the empty slots
    let idsIndex = 0;
    for (let i = 0; i < newOrderArray.length; i++) {
        if (newOrderArray[i] === null) {
            const id = ids[idsIndex++];
            const prompt = state.prompts.find(p => p.id === id);
            if (prompt) {
                newOrderArray[i] = prompt;
            }
        }
    }

    // Now update state.prompts with new orders
    state.prompts = newOrderArray.filter(Boolean).map((p, index) => ({ ...p, order: index }));

    saveState(state);
}

function initAutoScrollbars() {
    document.addEventListener('scroll', (e) => {
        // For window scroll, e.target is document, but we want to style body or html
        let target = e.target;
        if (target === document) {
            target = document.documentElement;
        }

        if (target && target.nodeType === 1) {
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
        }
    }, true);
}


function createFolder(name) {
    const exists = state.folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    const id = makeId("folder");
    state.folders.push({ id, name, locked: false, order: -1 });
    reindexFolderOrder();
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
    const payload = {
        title,
        content,
        folderId: folderId || undefined,
        updatedAt: Date.now(),
    };

    if (isCreatingNew) {
        const newPrompt = {
            ...payload,
            id: makeId("prompt"),
            order: state.prompts.length,
        };
        state.prompts.unshift(newPrompt);
        await saveState(state);
        editingPromptId = newPrompt.id;
        isCreatingNew = false;
        UI.renderFolders(state, currentFolderId);
        UI.renderPrompts(state, currentFolderId);
        UI.openEditorView(newPrompt);
        return;
    }

    if (!editingPromptId) return;
    state.prompts = state.prompts.map((item) =>
        item.id === editingPromptId ? { ...item, ...payload } : item
    );
    await saveState(state);
    UI.renderFolders(state, currentFolderId);
    UI.renderPrompts(state, currentFolderId);

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

async function exportPrompts() {
    const exportBtn = document.getElementById("export-prompts");
    if (!exportBtn) return;

    const originalText = exportBtn.textContent;
    // Use HTML for loading indicator
    exportBtn.innerHTML = 'Please wait<span class="loading-dots"></span>';
    exportBtn.classList.add("loading");

    // Add a small delay for the animation to be seen/UI to update
    await new Promise(r => setTimeout(r, 600));

    try {
        // Ensure JSZip is available
        if (typeof JSZip === "undefined") {
            throw new Error("JSZip library not loaded");
        }

        const zip = new JSZip();

        state.prompts.forEach((prompt) => {
            let filename = prompt.title || "Untitled";
            // Simple sanitization
            filename = filename.replace(/[\\/:*?"<>|]/g, "_") + ".md";
            zip.file(filename, prompt.content || "");
        });

        // Generate Blob
        const content = await zip.generateAsync({ type: "blob" });

        // Date format
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        // User requested yyyy/mm/dd but slash is invalid for filename, using dashes
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const filename = `monoprompt-export-${dateStr}.zip`;

        const url = URL.createObjectURL(content);

        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
        }, (downloadId) => {
            // Restore button state
            exportBtn.textContent = originalText;
            exportBtn.classList.remove("loading");

            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                // Optionally alert user or just log
            }
        });
    } catch (err) {
        console.error("Export failed", err);
        exportBtn.textContent = originalText;
        exportBtn.classList.remove("loading");
        alert("Export failed: " + err.message);
    }
}
