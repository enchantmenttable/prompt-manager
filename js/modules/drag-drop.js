let draggingPromptId = null;
let draggingFolderId = null;
let draggingFolderEl = null;
let folderPlaceholder = null;
let folderDragOffsetY = 0;
let folderDragMoved = false;
let folderPointerId = null;
let folderDragStartX = 0;
let folderDragStartY = 0;

let callbacks = {
    onPromptReorder: () => { },
    onFolderReorder: () => { },
    onRenderPrompts: () => { },
    onRenderFolders: () => { },
};

export function initDragDrop(cbs) {
    callbacks = { ...callbacks, ...cbs };
}

export function isDraggingFolder() {
    return !!draggingFolderId || justFinishedDrag;
}

let justFinishedDrag = false;

// Prompt Drag & Drop
export function handleDragStart(event) {
    const card = event.target.closest(".prompt-card");
    if (!card) return;
    draggingPromptId = card.dataset.id;
    card.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
}

export function handleDragOver(event) {
    event.preventDefault();
    const card = event.target.closest(".prompt-card");
    if (!card || card.dataset.id === draggingPromptId) return;
    card.classList.add("drag-over");
    event.dataTransfer.dropEffect = "move";
}

export function handleDragLeave(event) {
    const card = event.target.closest(".prompt-card");
    if (card) card.classList.remove("drag-over");
}

export function handleDrop(event) {
    event.preventDefault();
    const targetCard = event.target.closest(".prompt-card");
    if (!targetCard || targetCard.dataset.id === draggingPromptId) return;
    callbacks.onPromptReorder(draggingPromptId, targetCard.dataset.id);
    callbacks.onRenderPrompts();
}

export function handleDragEnd(event) {
    const card = event.target.closest(".prompt-card");
    if (card) {
        card.classList.remove("dragging");
        card.classList.remove("drag-over");
    }
    draggingPromptId = null;
}

// Folder Drag & Drop
export function handleFolderPointerDown(event, folderList) {
    if (event.button !== 0) return;
    if (!(event.target instanceof HTMLElement)) return;
    const folder = event.target.closest(".folder");
    if (!folder || folder.querySelector("[data-folder-delete]")?.contains(event.target)) return;

    // Do NOT prevent default here, otherwise click event won't fire.
    // event.preventDefault(); 

    draggingFolderId = folder.dataset.id;
    draggingFolderEl = folder;
    folderDragMoved = false;
    folderPointerId = event.pointerId ?? null;
    folderDragStartX = event.clientX;
    folderDragStartY = event.clientY;

    const folderRect = folder.getBoundingClientRect();
    const listRect = folderList.getBoundingClientRect();
    folderDragOffsetY = event.clientY - folderRect.top;

    ensureFolderPlaceholder(folderRect);
    // Don't insert placeholder yet, wait for move

    // Don't set styles yet, wait for move

    folder.setPointerCapture?.(event.pointerId);

    const onMove = (e) => handleFolderPointerMove(e, folderList);
    const onUp = (e) => {
        handleFolderPointerUp(e, folderList);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
}

function handleFolderPointerMove(event, folderList) {
    if (!draggingFolderId || !draggingFolderEl) return;

    if (!folderDragMoved) {
        const dx = event.clientX - folderDragStartX;
        const dy = event.clientY - folderDragStartY;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return; // Threshold

        folderDragMoved = true;

        // Initialize drag visual state
        if (folderPlaceholder && draggingFolderEl.parentNode === folderList) {
            folderList.insertBefore(folderPlaceholder, draggingFolderEl);
        }

        const folderRect = draggingFolderEl.getBoundingClientRect();
        const listRect = folderList.getBoundingClientRect();

        draggingFolderEl.classList.add("dragging");
        draggingFolderEl.style.width = `${folderRect.width}px`;
        draggingFolderEl.style.left = `${folderRect.left - listRect.left}px`;
        draggingFolderEl.style.top = `${folderRect.top - listRect.top + folderList.scrollTop}px`;
        draggingFolderEl.style.position = "absolute";
        draggingFolderEl.style.zIndex = "3";
        draggingFolderEl.style.pointerEvents = "none";
    }

    const listRect = folderList.getBoundingClientRect();
    const newTop = event.clientY - listRect.top + folderList.scrollTop - folderDragOffsetY;
    draggingFolderEl.style.top = `${newTop}px`;

    const target = getFolderFromPoint(event.clientX, event.clientY, folderList);
    if (!target || target === draggingFolderEl || target === folderPlaceholder) return;

    const targetRect = target.getBoundingClientRect();
    const before = event.clientY < targetRect.top + targetRect.height / 2;
    const firstPositions = captureFolderPositions(folderList);
    if (before) {
        folderList.insertBefore(folderPlaceholder, target);
    } else {
        folderList.insertBefore(folderPlaceholder, target.nextSibling);
    }
    playFlipAnimation(firstPositions, folderList);
}

function handleFolderPointerUp(event, folderList) {
    if (!draggingFolderEl) return;
    try {
        draggingFolderEl.releasePointerCapture?.(event.pointerId);
    } catch (err) {
        // ignore
    }

    if (folderDragMoved) {
        justFinishedDrag = true;
        setTimeout(() => { justFinishedDrag = false; }, 0);

        draggingFolderEl.classList.remove("dragging");
        draggingFolderEl.style.position = "";
        draggingFolderEl.style.top = "";
        draggingFolderEl.style.left = "";
        draggingFolderEl.style.width = "";
        draggingFolderEl.style.zIndex = "";
        draggingFolderEl.style.pointerEvents = "";

        if (folderPlaceholder) {
            folderList.insertBefore(draggingFolderEl, folderPlaceholder);
            folderPlaceholder.remove();
            folderPlaceholder = null;
        }

        const orderedIds = Array.from(folderList.querySelectorAll(".folder")).map((el) => el.dataset.id);
        callbacks.onFolderReorder(orderedIds);
        callbacks.onRenderFolders(); // Re-render to clean up
        callbacks.onRenderPrompts();
    } else {
        // Was a click, clean up placeholder if it exists (shouldn't if not moved)
        if (folderPlaceholder) {
            folderPlaceholder.remove();
            folderPlaceholder = null;
        }
    }

    draggingFolderId = null;
    draggingFolderEl = null;
    folderDragMoved = false;
}

function captureFolderPositions(folderList) {
    const positions = new Map();
    folderList.querySelectorAll(".folder").forEach((el) => {
        positions.set(el.dataset.id, el.getBoundingClientRect());
    });
    return positions;
}

function ensureFolderPlaceholder(rect) {
    if (!folderPlaceholder) {
        folderPlaceholder = document.createElement("div");
        folderPlaceholder.className = "folder placeholder";
    }
    folderPlaceholder.style.height = `${rect.height}px`;
    folderPlaceholder.style.width = `${rect.width}px`;
}

function playFlipAnimation(firstPositions, folderList) {
    folderList.querySelectorAll(".folder").forEach((el) => {
        if (el === draggingFolderEl) return;
        const first = firstPositions.get(el.dataset.id);
        if (!first) return;
        const last = el.getBoundingClientRect();
        const dy = first.top - last.top;
        if (!dy) return;
        el.style.transition = "none";
        el.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
            el.style.transition = "transform 200ms ease-out";
            el.style.transform = "translateY(0)";
            setTimeout(() => {
                el.style.transition = "";
                el.style.transform = "";
            }, 220);
        });
    });
}

function getFolderFromPoint(x, y, folderList) {
    const el = document.elementFromPoint(x, y);
    if (!(el instanceof HTMLElement)) return null;
    const folder = el.closest(".folder");
    if (folder && folderList.contains(folder)) return folder;
    return null;
}

export function clearFolderDragIndicators(folderList) {
    folderList.querySelectorAll(".folder").forEach((btn) => {
        btn.classList.remove("drag-over", "shift-up", "shift-down");
    });
}
