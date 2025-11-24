import { createDefaultState, loadState, makeId, saveState } from "./storage.js";

let state = createDefaultState();
let currentFolderId = "all";
let editingPromptId = null;
let initialPromptSnapshot = null;
let pendingFolderDelete = null;
let draggingPromptId = null;

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

async function init() {
  state = await loadState();
  normalizePromptOrder();
  renderFolders();
  renderPrompts();
  bindEvents();
}

function bindEvents() {
  searchInput.addEventListener("input", () => renderPrompts());
  addFolderButton.addEventListener("click", handleAddFolder);
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
  if (prompt) openPromptModal(prompt);
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

function renderFolders() {
  folderList.innerHTML = "";
  const folders = state.folders
    .filter((f) => f.id !== "all")
    .sort((a, b) => a.name.localeCompare(b.name));

  folders.forEach((folder) => {
    const button = document.createElement("button");
    button.className = `folder${folder.id === currentFolderId ? " active" : ""}`;
    button.dataset.id = folder.id;
    button.innerHTML = `
      <span class="folder-name">${folder.name}</span>
      <button class="trash" data-folder-delete="${folder.id}" aria-label="Delete folder">
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
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-folder-delete]")) return;
      currentFolderId = folder.id;
      setActiveNav();
      renderFolders();
      renderPrompts();
    });
    const trashBtn = button.querySelector("[data-folder-delete]");
    trashBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      pendingFolderDelete = folder.id;
      showFolderConfirm();
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
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "No folder";
  promptFolderSelect.appendChild(noneOption);
  const options = state.folders.filter((f) => f.id !== "all");
  options.forEach((folder) => {
    const opt = document.createElement("option");
    opt.value = folder.id;
    opt.textContent = folder.name;
    promptFolderSelect.appendChild(opt);
  });
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
    const updated = prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleDateString() : "";
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

async function handleAddFolder() {
  const name = prompt("Name your folder:")?.trim();
  if (!name) return;
  const exists = state.folders.some(
    (folder) => folder.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) return;
  const id = makeId("folder");
  state.folders.push({ id, name, locked: false });
  currentFolderId = id;
  await saveState(state);
  renderFolders();
  renderPrompts();
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
  renderFolders();
  renderPrompts();
}

function setActiveNav() {
  const isAll = currentFolderId === "all";
  navAllButton.classList.toggle("active", isAll);
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

init();
