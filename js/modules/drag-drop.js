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
let promptPlaceholder = null;
let promptDragOffsetY = 0;
let promptDragOffsetX = 0;
let promptDragMoved = false;
let promptDragStartX = 0;
let promptDragStartY = 0;
let draggingPromptEl = null;
let lastPromptTarget = null;

export function isDraggingPrompt() {
    return !!draggingPromptId || promptDragMoved;
}

export function handlePromptPointerDown(event, promptGrid) {
    if (event.button !== 0) return;
    if (!(event.target instanceof HTMLElement)) return;

    // Ignore clicks on buttons/actions
    if (event.target.closest("button") || event.target.closest(".prompt-actions")) return;

    const card = event.target.closest(".prompt-card");
    if (!card) return;


    // Prevent default to stop native drag/selection and ensure pointer events keep firing
    event.preventDefault();

    draggingPromptId = card.dataset.id;
    draggingPromptEl = card;
    promptDragMoved = false;
    promptDragStartX = event.clientX;
    promptDragStartY = event.clientY;

    const cardRect = card.getBoundingClientRect();
    promptDragOffsetY = event.clientY - cardRect.top;
    promptDragOffsetX = event.clientX - cardRect.left;

    ensurePromptPlaceholder(cardRect);

    try {
        card.setPointerCapture?.(event.pointerId);
    } catch (e) {
        // Failed to capture pointer
    }

    const onMove = (e) => handlePromptPointerMove(e, promptGrid);
    const onUp = (e) => {
        handlePromptPointerUp(e, promptGrid);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
}

function handlePromptPointerMove(event, promptGrid) {
    if (!draggingPromptId || !draggingPromptEl) return;

    if (!promptDragMoved) {
        const dx = event.clientX - promptDragStartX;
        const dy = event.clientY - promptDragStartY;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return; // Threshold

        promptDragMoved = true;

        // Initialize drag visual state
        const cardRect = draggingPromptEl.getBoundingClientRect();
        // const gridRect = promptGrid.getBoundingClientRect(); // Not strictly needed if fixed/absolute to body, but good for relative calc if needed

        // Insert placeholder
        if (promptPlaceholder && draggingPromptEl.parentNode === promptGrid) {
            promptGrid.insertBefore(promptPlaceholder, draggingPromptEl);
        }

        draggingPromptEl.classList.add("dragging");
        draggingPromptEl.style.width = `${cardRect.width}px`;
        draggingPromptEl.style.height = `${cardRect.height}px`;
        // Use fixed positioning for the floating element to avoid scroll issues relative to parent
        draggingPromptEl.style.position = "fixed";
        draggingPromptEl.style.zIndex = "1000";
        draggingPromptEl.style.left = `${cardRect.left}px`;
        draggingPromptEl.style.top = `${cardRect.top}px`;
        draggingPromptEl.style.pointerEvents = "none";
    }

    // Update position of the floating card
    draggingPromptEl.style.left = `${event.clientX - promptDragOffsetX}px`;
    draggingPromptEl.style.top = `${event.clientY - promptDragOffsetY}px`;

    const target = getPromptFromPoint(event.clientX, event.clientY, promptGrid);
    if (!target || target === draggingPromptEl || target === promptPlaceholder) return;

    const targetRect = target.getBoundingClientRect();
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    // Logic inspired by folder drag-and-drop but adapted for grid:
    // If we are clearly in the top part of the card -> Insert Before
    // If we are clearly in the bottom part -> Insert After
    // If we are in the middle -> Use Left/Right to decide

    // Use a threshold to define "middle row"
    const rowThreshold = targetRect.height / 4; // 25% top, 50% middle, 25% bottom

    let insertAfter;
    if (event.clientY < targetCenterY - rowThreshold) {
        insertAfter = false; // Top part -> Before
    } else if (event.clientY > targetCenterY + rowThreshold) {
        insertAfter = true; // Bottom part -> After
    } else {
        insertAfter = event.clientX > targetCenterX; // Middle part -> Left/Right
    }

    const children = Array.from(promptGrid.children);
    const placeholderIndex = children.indexOf(promptPlaceholder);
    const targetIndex = children.indexOf(target);

    // Optimization: Don't move if we are already in the right spot relative to target
    // Note: placeholderIndex might be -1 if not in DOM yet (though it should be)

    if (insertAfter) {
        // We want to be after target.
        // If placeholder is already target.nextSibling, do nothing.
        if (target.nextSibling === promptPlaceholder) return;
    } else {
        // We want to be before target.
        // If placeholder is already target.previousSibling (or target is nextSibling of placeholder), do nothing.
        if (promptPlaceholder.nextSibling === target) return;
    }

    // Capture positions BEFORE DOM change
    const firstPositions = capturePromptPositions(promptGrid);

    if (insertAfter) {
        promptGrid.insertBefore(promptPlaceholder, target.nextSibling);
    } else {
        promptGrid.insertBefore(promptPlaceholder, target);
    }

    // Play animation AFTER DOM change
    playPromptFlipAnimation(firstPositions, promptGrid);
}

// Removed findClosestPromptCard as we rely on getPromptFromPoint

function capturePromptPositions(promptGrid) {
    const positions = new Map();
    promptGrid.querySelectorAll(".prompt-card").forEach((el) => {
        if (el === draggingPromptEl || el.classList.contains("placeholder")) return;
        positions.set(el.dataset.id, el.getBoundingClientRect());
    });
    return positions;
}

function playPromptFlipAnimation(firstPositions, promptGrid) {
    promptGrid.querySelectorAll(".prompt-card").forEach((el) => {
        if (el === draggingPromptEl || el.classList.contains("placeholder")) return;
        const first = firstPositions.get(el.dataset.id);
        if (!first) return;
        const last = el.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (!dx && !dy) return;

        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;

        requestAnimationFrame(() => {
            el.style.transition = "transform 200ms ease-out";
            el.style.transform = "";
            setTimeout(() => {
                el.style.transition = "";
            }, 200);
        });
    });
}

function handlePromptPointerUp(event, promptGrid) {
    if (!draggingPromptEl) return;
    try {
        draggingPromptEl.releasePointerCapture?.(event.pointerId);
    } catch (err) {
        // ignore
    }

    if (promptDragMoved) {
        draggingPromptEl.classList.remove("dragging");
        draggingPromptEl.style.position = "";
        draggingPromptEl.style.width = "";
        draggingPromptEl.style.height = "";
        draggingPromptEl.style.left = "";
        draggingPromptEl.style.top = "";
        draggingPromptEl.style.zIndex = "";
        draggingPromptEl.style.cursor = "";
        draggingPromptEl.style.pointerEvents = "";

        if (promptPlaceholder) {
            promptGrid.insertBefore(draggingPromptEl, promptPlaceholder);
            promptPlaceholder.remove();
            promptPlaceholder = null;
        }

        // Determine new order
        // We can just read the DOM order
        const orderedIds = Array.from(promptGrid.querySelectorAll(".prompt-card")).map(el => el.dataset.id);

        // We need to map this back to state.prompts order
        // But wait, reorderPrompts takes fromId and toId.
        // Here we have a full list.
        // Let's update callbacks to accept full list or just use the logic to find the new index.
        // Actually, simpler to just update the order based on DOM.
        // But `reorderPrompts` in options.js expects (fromId, toId).
        // Let's change `callbacks.onPromptReorder` to accept a list of IDs?
        // Or we can just find the new index of the dragged item.

        // Let's assume we update options.js to handle full list reorder, similar to folders.
        // Or we can calculate the move.
        // Let's update options.js to accept `onPromptReorder(ids)`.

        callbacks.onPromptReorder(orderedIds);
        callbacks.onRenderPrompts();
    } else {
        // It was a click!
        if (promptPlaceholder) {
            promptPlaceholder.remove();
            promptPlaceholder = null;
        }
        callbacks.onPromptClick?.(draggingPromptId);
    }

    draggingPromptId = null;
    draggingPromptEl = null;
    promptDragMoved = false;
    lastPromptTarget = null;
}

function ensurePromptPlaceholder(rect) {
    if (!promptPlaceholder) {
        promptPlaceholder = document.createElement("article");
        promptPlaceholder.className = "prompt-card placeholder";
    }
    // Copy dimensions? CSS handles it mostly, but grid might be tricky.
    // Actually, in a grid, the placeholder just needs to be an element.
    // But we should set min-height or height if needed.
    promptPlaceholder.style.height = `${rect.height}px`;
    promptPlaceholder.style.width = `${rect.width}px`;
}

function getPromptFromPoint(x, y, promptGrid) {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
        const card = el.closest(".prompt-card");
        if (!card) continue;
        if (card === draggingPromptEl) continue; // Skip the card being dragged
        if (card.classList.contains("placeholder")) continue;
        if (promptGrid.contains(card)) return card;
    }
    return null;
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
