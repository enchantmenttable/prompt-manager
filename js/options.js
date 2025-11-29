import { createDefaultState, loadState, makeId, saveState } from "./storage.js";

let state = createDefaultState();
let currentFolderId = "all";
let editingPromptId = null;
let initialPromptSnapshot = null;
let pendingFolderDelete = null;
let draggingPromptId = null;
let draggingFolderId = null;
let draggingFolderEl = null;
let folderPlaceholder = null;
let folderDragOffsetY = 0;
let folderDragMoved = false;
let folderPointerId = null;
let folderDragStartX = 0;
let folderDragStartY = 0;
let folderDragActive = false;
let lastFolderHoverId = null;
let lastFolderHoverBefore = null;
let editorSnapshot = null;

const folderList = document.getElementById("folder-list");
const promptGrid = document.getElementById("prompt-grid");
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

async function init() {
  state = await loadState();
  normalizePromptOrder();
  normalizeFolderOrder();
  renderFolders();
  renderPrompts();
  bindEvents();
}

function getOrderedFolders() {
  return state.folders
    .filter((f) => f.id !== "all")
    .sort((a, b) => {
      const orderA = Number.isFinite(a.order) ? a.order : 0;
      const orderB = Number.isFinite(b.order) ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
}

function bindEvents() {
  searchInput.addEventListener("input", () => renderPrompts());
  addFolderButton.addEventListener("click", handleAddFolderButton);
  navAllButton.addEventListener("click", () => {
    currentFolderId = "all";
    setActiveNav();
    renderFolders();
    renderPrompts();
  });
  newPromptButton.addEventListener("click", () => openPromptModal());
  cancelModal.addEventListener("click", hideModal);
  closeModal.addEventListener("click", hideModal);
  deletePromptButton.addEventListener("click", () => deletePrompt(editingPromptId));
  promptForm.addEventListener("submit", handlePromptSubmit);
  promptGrid.addEventListener("click", handleCardActions);
  cancelFolderDelete.addEventListener("click", hideFolderConfirm);
  confirmFolderDelete.addEventListener("click", confirmDeleteFolder);
  promptTitleInput.addEventListener("input", updateSaveState);
  promptContentInput.addEventListener("input", updateSaveState);
  promptFolderSelect.addEventListener("change", updateSaveState);
  promptGrid.addEventListener("dragstart", handleDragStart);
  promptGrid.addEventListener("dragover", handleDragOver);
  promptGrid.addEventListener("dragleave", handleDragLeave);
  promptGrid.addEventListener("drop", handleDrop);
  promptGrid.addEventListener("dragend", handleDragEnd);
  folderList.addEventListener("pointerdown", handleFolderPointerDown);
  editorBack?.addEventListener("click", closeEditorView);
  editorForm?.addEventListener("input", updateEditorSaveState);
  editorForm?.addEventListener("change", updateEditorSaveState);
  editorSaveButton?.addEventListener("click", handleEditorSave);
  editorDeleteButton?.addEventListener("click", handleEditorDelete);
  editorCopyButton?.addEventListener("click", handleEditorCopy);
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
  if (prompt) openEditorView(prompt);
}

function handleDragStart(event) {
  const card = event.target.closest(".prompt-card");
  if (!card) return;
  draggingPromptId = card.dataset.id;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
}

function handleDragOver(event) {
  event.preventDefault();
  const card = event.target.closest(".prompt-card");
  if (!card || card.dataset.id === draggingPromptId) return;
  card.classList.add("drag-over");
  event.dataTransfer.dropEffect = "move";
}

function handleDragLeave(event) {
  const card = event.target.closest(".prompt-card");
  if (card) card.classList.remove("drag-over");
}

function handleDrop(event) {
  event.preventDefault();
  const targetCard = event.target.closest(".prompt-card");
  if (!targetCard || targetCard.dataset.id === draggingPromptId) return;
  reorderPrompts(draggingPromptId, targetCard.dataset.id);
  renderPrompts();
}

function handleDragEnd(event) {
  const card = event.target.closest(".prompt-card");
  if (card) {
    card.classList.remove("dragging");
    card.classList.remove("drag-over");
  }
  draggingPromptId = null;
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

function handleAddFolderButton() {
  if (folderDragActive) return;
  showAddFolderForm();
}

function showAddFolderForm() {
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
    createFolder(name);
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

function hideAddFolderForm() {
  const panel = document.querySelector(".add-folder-panel");
  if (panel) panel.remove();
  addFolderButton.classList.remove("hidden");
}

function createFolder(name) {
  const exists = state.folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase());
  if (exists) return;
  const id = makeId("folder");
  const nextOrder = state.folders.filter((f) => f.id !== "all").length;
  state.folders.push({ id, name, locked: false, order: nextOrder });
  currentFolderId = id;
  saveState(state);
  renderFolders();
  renderPrompts();
}

function handleFolderPointerDown(event) {
  if (event.button !== 0) return;
  if (!(event.target instanceof HTMLElement)) return;
  const folder = event.target.closest(".folder");
  if (!folder || folder.querySelector("[data-folder-delete]")?.contains(event.target)) return;
  draggingFolderId = folder.dataset.id;
  draggingFolderEl = folder;
  folderDragMoved = false;
  folderDragStartX = event.clientX;
  folderDragStartY = event.clientY;
  folderPointerId = null;
  folderDragActive = false;
  lastFolderHoverId = null;
  lastFolderHoverBefore = null;

  window.addEventListener("pointermove", handleFolderPointerMove);
  window.addEventListener("pointerup", handleFolderPointerUp);
}

function handleFolderPointerMove(event) {
  if (!draggingFolderId || !draggingFolderEl) return;
  const deltaX = Math.abs(event.clientX - folderDragStartX);
  const deltaY = Math.abs(event.clientY - folderDragStartY);
  if (!folderDragActive && deltaX < 3 && deltaY < 3) return;
  if (!folderDragActive) {
    beginFolderDrag(event);
  }
  const listRect = folderList.getBoundingClientRect();
  const newTop = event.clientY - listRect.top + folderList.scrollTop - folderDragOffsetY;
  draggingFolderEl.style.top = `${newTop}px`;

  if (!folderDragMoved && (deltaX >= 3 || deltaY >= 3)) {
    folderDragMoved = true;
  }
  folderDragMoved = true;
  updateFolderPlaceholder(event);
}

function handleFolderPointerUp() {
  if (!draggingFolderId) return;
  const slots = Array.from(folderList.querySelectorAll(".folder")).filter(
    (el) => el !== draggingFolderEl
  );
  const orderedIds = slots.map((el) =>
    el === folderPlaceholder ? draggingFolderId : el.dataset.id
  );
  restoreDraggedFolder();
  if (folderDragActive && folderDragMoved && orderedIds.length) {
    applyFolderOrderFromIds(orderedIds);
    renderFolders();
    renderPrompts();
  }
  window.removeEventListener("pointermove", handleFolderPointerMove);
  window.removeEventListener("pointerup", handleFolderPointerUp);
  draggingFolderId = null;
  draggingFolderEl = null;
  folderDragMoved = false;
  folderDragActive = false;
  lastFolderHoverId = null;
  lastFolderHoverBefore = null;
}

function ensureFolderPlaceholder(height) {
  if (!folderPlaceholder) {
    folderPlaceholder = document.createElement("div");
    folderPlaceholder.className = "folder placeholder";
  }
  folderPlaceholder.style.height = `${height}px`;
}

function captureFolderPositions() {
  const positions = new Map();
  folderList.querySelectorAll(".folder").forEach((el) => {
    if (el === draggingFolderEl || el === folderPlaceholder) return;
    positions.set(el.dataset.id, el.getBoundingClientRect());
  });
  return positions;
}

function playFlipAnimation(firstPositions) {
  folderList.querySelectorAll(".folder").forEach((el) => {
    if (el === draggingFolderEl || el === folderPlaceholder) return;
    const first = firstPositions.get(el.dataset.id);
    if (!first) return;
    const last = el.getBoundingClientRect();
    const dy = first.top - last.top;
    if (!dy) return;
    el.style.transition = "none";
    el.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = "transform 240ms ease-out";
      el.style.transform = "translateY(0)";
      setTimeout(() => {
        el.style.transition = "";
        el.style.transform = "";
      }, 260);
    });
  });
}

function updateFolderPlaceholder(event) {
  if (!folderPlaceholder || !draggingFolderEl) return;
  const target = getFolderFromPoint(event.clientX, event.clientY);
  if (!target || target === folderPlaceholder || target.dataset.id === draggingFolderId) return;
  const targetRect = target.getBoundingClientRect();
  const y = event.clientY;
  const upper = targetRect.top + targetRect.height * 0.35;
  const lower = targetRect.top + targetRect.height * 0.65;
  const currentIndex = Array.from(folderList.querySelectorAll(".folder")).indexOf(
    folderPlaceholder
  );
  let before = null;
  if (y < upper) before = true;
  else if (y > lower) before = false;

  const targetId = target.dataset.id;
  if (targetId === lastFolderHoverId && before === lastFolderHoverBefore) return;
  lastFolderHoverId = targetId;
  lastFolderHoverBefore = before;

  const slots = Array.from(folderList.querySelectorAll(".folder")).filter(
    (el) => el !== draggingFolderEl && el !== folderPlaceholder
  );
  const targetIndex = slots.indexOf(target);
  let desiredIndex = currentIndex;
  if (before === true) desiredIndex = targetIndex;
  else if (before === false) desiredIndex = targetIndex + 1;
  if (desiredIndex === -1) desiredIndex = slots.length;
  if (desiredIndex === currentIndex) return;

  const firstPositions = captureFolderPositions();
  const insertBefore = slots[desiredIndex] || null;
  folderList.insertBefore(folderPlaceholder, insertBefore);
  playFlipAnimation(firstPositions);
}

function restoreDraggedFolder() {
  if (!draggingFolderEl) return;
  if (folderPlaceholder && folderList.contains(folderPlaceholder)) {
    folderList.insertBefore(draggingFolderEl, folderPlaceholder);
    folderPlaceholder.remove();
    folderPlaceholder = null;
  } else if (!folderList.contains(draggingFolderEl)) {
    folderList.appendChild(draggingFolderEl);
  }
  draggingFolderEl.classList.remove("dragging");
  draggingFolderEl.style.position = "";
  draggingFolderEl.style.top = "";
  draggingFolderEl.style.left = "";
  draggingFolderEl.style.width = "";
  draggingFolderEl.style.zIndex = "";
  draggingFolderEl.style.pointerEvents = "";
  try {
    if (folderPointerId != null) {
      draggingFolderEl.releasePointerCapture?.(folderPointerId);
    }
  } catch (err) {
    // ignore release issues
  }
  folderPointerId = null;
}

function getFolderFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!(el instanceof HTMLElement)) return null;
  const folder = el.closest(".folder");
  if (folder && folderList.contains(folder)) return folder;
  return null;
}

function beginFolderDrag(event) {
  if (!draggingFolderEl) return;
  folderDragActive = true;
  folderPointerId = event.pointerId;
  const folderRect = draggingFolderEl.getBoundingClientRect();
  const listRect = folderList.getBoundingClientRect();
  folderDragOffsetY = event.clientY - folderRect.top;
  ensureFolderPlaceholder(folderRect.height);
  if (folderPlaceholder && draggingFolderEl.parentNode === folderList) {
    folderList.insertBefore(folderPlaceholder, draggingFolderEl);
  }
  draggingFolderEl.classList.add("dragging");
  draggingFolderEl.style.width = `${folderRect.width}px`;
  draggingFolderEl.style.left = `${folderRect.left - listRect.left}px`;
  draggingFolderEl.style.top = `${folderRect.top - listRect.top + folderList.scrollTop}px`;
  draggingFolderEl.style.position = "absolute";
  draggingFolderEl.style.zIndex = "3";
  draggingFolderEl.style.pointerEvents = "none";
  draggingFolderEl.setPointerCapture?.(event.pointerId);
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

function clearFolderDragIndicators() {
  folderList.querySelectorAll(".folder").forEach((btn) => {
    btn.classList.remove("drag-over", "shift-up", "shift-down");
  });
}

function renderFolders() {
  folderList.innerHTML = "";
  const folders = getOrderedFolders();

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
      if (folderDragActive) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-folder-delete]")) return;
      activateFolder(folder.id);
    });
    const trashBtn = button.querySelector("[data-folder-delete]");
    trashBtn?.setAttribute("draggable", "false");
    trashBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      pendingFolderDelete = folder.id;
      showFolderConfirm();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateFolder(folder.id);
      }
    });
    folderList.appendChild(button);
  });
  viewTitle.textContent =
    (folders.find((f) => f.id === currentFolderId)?.name || "All Prompts").toUpperCase();
  renderFolderSelect();
  setActiveNav();
}

function renderFolderSelect() {
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

  // Keep selections stable when editing after re-rendering folders
  const activePrompt = editingPromptId
    ? state.prompts.find((p) => p.id === editingPromptId)
    : null;
  const targetFolderId = activePrompt?.folderId || "";
  if (editorFolderSelect) {
    editorFolderSelect.value = targetFolderId;
  }
}

function renderPrompts() {
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
    empty.innerHTML = `
      <div class="empty-icon"></div>
      <div>No prompts found.</div>
      <div class="hint">Create one to get started.</div>
    `;
    promptGrid.appendChild(empty);
    return;
  }

  visiblePrompts.forEach((prompt) => {
    const card = document.createElement("article");
    card.className = "prompt-card";
    card.dataset.id = prompt.id;
    card.draggable = true;
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
    promptGrid.appendChild(card);
    attachCardReset(card);
  });
}

function sanitize(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML.replace(/\n/g, "<br>");
}

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

function openPromptModal(prompt) {
  promptModal.classList.remove("hidden");
  editingPromptId = prompt?.id || null;
  modalTitle.textContent = prompt ? "Edit Prompt" : "New Prompt";
  deletePromptButton.classList.toggle("hidden", !prompt);
  promptTitleInput.value = prompt?.title || "";
  promptContentInput.value = prompt?.content || "";
  promptFolderSelect.value =
    prompt?.folderId ||
    state.folders.find((f) => f.id === currentFolderId && f.id !== "all")?.id ||
    "";
  initialPromptSnapshot = captureSnapshot();
  updateSaveState();
}

function hideModal() {
  promptModal.classList.add("hidden");
  editingPromptId = null;
  promptForm.reset();
  initialPromptSnapshot = null;
}

function openEditorView(prompt) {
  editingPromptId = prompt.id;
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

function closeEditorView() {
  editingPromptId = null;
  editorSnapshot = null;
  editorForm.reset();
  editorView?.classList.add("hidden");
  listView?.classList.remove("hidden");
  mainContainer?.classList.remove("editing");
}

async function handlePromptSubmit(event) {
  event.preventDefault();
  if (savePromptButton?.disabled) return;
  const title = promptTitleInput.value.trim();
  const content = promptContentInput.value.trim();
  const folderId = promptFolderSelect.value;
  if (!content) return;

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
  initialPromptSnapshot = captureSnapshot();
  updateSaveState();
  hideModal();
  renderFolders();
  renderPrompts();
}

async function deletePrompt(id) {
  if (!id) return;
  const confirmed = confirm("Delete this prompt?");
  if (!confirmed) return;
  state.prompts = state.prompts.filter((item) => item.id !== id);
  reindexPromptOrder();
  await saveState(state);
  hideModal();
  closeEditorView();
  renderFolders();
  renderPrompts();
}

async function handleEditorSave(event) {
  event.preventDefault();
  if (editorSaveButton.disabled || !editingPromptId) return;
  const title = editorTitleInput.value.trim();
  const content = editorContentInput.value.trim();
  const folderId = editorFolderSelect.value;
  if (!content) return;
  state.prompts = state.prompts.map((item) =>
    item.id === editingPromptId
      ? { ...item, title, content, folderId: folderId || undefined, updatedAt: Date.now() }
      : item
  );
  await saveState(state);
  editorSnapshot = captureEditorSnapshot();
  updateEditorSaveState();
  renderFolders();
  renderPrompts();
}

function setActiveNav() {
  const isAll = currentFolderId === "all";
  navAllButton.classList.toggle("active", isAll);
}

function activateFolder(folderId) {
  currentFolderId = folderId;
  setActiveNav();
  renderFolders();
  renderPrompts();
  clearFolderDragIndicators();
}

function showFolderConfirm() {
  folderConfirmModal.classList.remove("hidden");
}

function hideFolderConfirm() {
  folderConfirmModal.classList.add("hidden");
  pendingFolderDelete = null;
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
  hideFolderConfirm();
  renderFolders();
  renderPrompts();
}

function copyPrompt(id) {
  const prompt = state.prompts.find((item) => item.id === id);
  if (!prompt) return;
  const card = promptGrid.querySelector(`.prompt-card[data-id="${id}"]`);
  const copyButton = card?.querySelector(".copy-chip");
  if (copyButton) {
    copyButton.textContent = "Copied";
  }
  navigator.clipboard?.writeText(prompt.content);
}

function attachCardReset(card) {
  card.addEventListener("mouseleave", () => resetCardUI(card));
  card.addEventListener("mouseenter", () => resetCopyText(card));
}

function resetCardUI(card) {
  const copyButton = card.querySelector(".copy-chip");
  if (copyButton) {
    copyButton.blur();
  }
}

function resetCopyText(card) {
  const copyButton = card.querySelector(".copy-chip");
  if (copyButton) {
    copyButton.textContent = "Copy";
  }
}

function handleEditorDelete(event) {
  event.preventDefault();
  if (!editingPromptId) return;
  deletePrompt(editingPromptId);
}

function handleEditorCopy(event) {
  event.preventDefault();
  if (!editingPromptId) return;
  copyPrompt(editingPromptId);
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
  const nonAll = state.folders.filter((f) => f.id !== "all");
  nonAll.forEach((folder, index) => {
    if (!Number.isFinite(folder.order)) {
      folder.order = index;
      changed = true;
    }
  });
  if (changed) {
    reindexFolderOrder();
    saveState(state);
  }
}

init();
