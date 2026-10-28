(() => {
  "use strict";

  const STORAGE_KEY = `academic-html-ppt:v1:${location.pathname}`;
  const deck = document.getElementById("deck");
  let slides = [...document.querySelectorAll(".slide")];
  const toolbar = document.getElementById("edit-toolbar");
  const toggleButton = document.getElementById("edit-toggle");
  const memoPanel = document.getElementById("memo-panel");
  const memoList = document.getElementById("memo-list");
  const fontSizeInput = document.getElementById("font-size");
  const strokeWidthInput = document.getElementById("stroke-width");
  const strokeColorInput = document.getElementById("stroke-color");
  const rotationInput = document.getElementById("rotation");
  const importFile = document.getElementById("import-file");
  const imageFile = document.getElementById("image-file");
  const videoFile = document.getElementById("video-file");
  const saveStatus = document.getElementById("save-status");
  const MEDIA_DB_NAME = "academic-html-ppt-media";
  const MEDIA_STORE_NAME = "media";

  let editMode = false;
  let selected = null;
  let history = [];
  let historyIndex = -1;
  let saveTimer = 0;
  let actionInProgress = false;
  const baseline = new Map();
  const liveMediaUrls = new Set();

  initializeSlides();

  function initializeSlides() {
    slides = [...deck.querySelectorAll(":scope > .slide")];
    slides.forEach((slide, slideIndex) => {
      if (!slide.dataset.slideId) {
        slide.dataset.slideId = slide.dataset.customSlide === "true"
          ? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          : `base-${slideIndex + 1}`;
      }
      const layer = slide.querySelector(".canvas-layer");
      if (layer) layer.dataset.slideIndex = String(slideIndex);
      [...slide.querySelectorAll("[data-editable]")].forEach((el, editIndex) => {
        // Retained source elements can keep a stable ID after nearby content is removed.
        // A duplicated slide must receive IDs belonging to its new slide ID.
        const existingId = el.dataset.editId;
        const id = existingId?.startsWith(`${slide.dataset.slideId}-e`)
          ? existingId : `${slide.dataset.slideId}-e${editIndex + 1}`;
        el.dataset.editId = id;
        if (!baseline.has(id)) baseline.set(id, { html: el.innerHTML, style: styleState(el) });
        el.contentEditable = editMode ? "true" : "false";
        el.spellcheck = false;
      });
      const number = slide.querySelector(".slide-number");
      if (number) {
        number.dataset.current = String(slideIndex + 1);
        number.dataset.total = String(slides.length);
      }
    });
  }

  function createBlankSlide(slideIndex, title = "새 슬라이드 제목") {
    const slide = document.createElement("section");
    slide.className = "slide blank-slide";
    slide.dataset.title = title;
    slide.dataset.customSlide = "true";
    slide.dataset.slideId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    slide.innerHTML = `
      <div class="new-slide-badge">새 슬라이드</div>
      <p class="section-label" data-editable>NEW SLIDE</p>
      <h2 class="h2" data-editable>${title}</h2>
      <div class="blank-slide-body" data-editable>
        <p><strong>핵심 내용을 입력하세요.</strong></p>
        <ul><li>첫 번째 근거 또는 메시지</li><li>두 번째 근거 또는 메시지</li></ul>
      </div>
      <p class="source-line" data-editable>출처 또는 보충 설명을 입력하세요.</p>
      <div class="canvas-layer" aria-label="슬라이드 도형 레이어"></div>
      <div class="deck-footer"><span>NEW SLIDE</span><span class="slide-number" data-current="${slideIndex + 1}" data-total="${slideIndex + 1}"></span></div>
      <aside class="notes"><p>발표자 메모를 입력하세요.</p></aside>`;
    return slide;
  }

  function duplicateCurrentSlide() {
    const source = activeSlide();
    const slide = source.cloneNode(true);
    slide.classList.remove("is-active", "is-prev");
    slide.removeAttribute("style");
    slide.dataset.customSlide = "true";
    slide.dataset.slideId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    slide.dataset.sourceSlideId = source.dataset.slideId || "";
    const sourceTitle = (source.dataset.title || "복제본").replace(/^새 슬라이드 ·\s*/, "");
    slide.dataset.title = `새 슬라이드 · ${sourceTitle}`;
    slide.querySelectorAll(".is-selected").forEach(el => el.classList.remove("is-selected"));
    let badge = slide.querySelector(".new-slide-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "new-slide-badge";
      slide.prepend(badge);
    }
    badge.textContent = "새 슬라이드";
    slide.querySelectorAll(".ppt-shape").forEach(shape => {
      shape.dataset.shapeId = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    });
    source.insertAdjacentElement("afterend", slide);
    initializeSlides();
    persist(false);
    sessionStorage.setItem(`${STORAGE_KEY}:resume-edit`, "1");
    location.hash = `#/${slides.indexOf(slide) + 1}`;
    location.reload();
  }

  function styleState(el) {
    return {
      fontSize: el.style.fontSize || "",
      fontWeight: el.style.fontWeight || "",
      textAlign: el.style.textAlign || ""
    };
  }

  function openMediaDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("이 브라우저는 미디어 저장을 지원하지 않습니다."));
      const request = indexedDB.open(MEDIA_DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(MEDIA_STORE_NAME)) request.result.createObjectStore(MEDIA_STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("미디어 저장소를 열 수 없습니다."));
    });
  }

  async function storeMediaBlob(mediaId, blob) {
    const db = await openMediaDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, "readwrite");
      tx.objectStore(MEDIA_STORE_NAME).put(blob, mediaId);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("미디어를 저장하지 못했습니다."));
    });
    db.close();
  }

  async function loadMediaBlob(mediaId) {
    const db = await openMediaDb();
    const blob = await new Promise((resolve, reject) => {
      const request = db.transaction(MEDIA_STORE_NAME, "readonly").objectStore(MEDIA_STORE_NAME).get(mediaId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("미디어를 불러오지 못했습니다."));
    });
    db.close();
    return blob;
  }

  async function deleteMediaBlob(mediaId) {
    if (!mediaId) return;
    const db = await openMediaDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, "readwrite");
      tx.objectStore(MEDIA_STORE_NAME).delete(mediaId);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("미디어를 삭제하지 못했습니다."));
    });
    db.close();
  }

  function activeSlide() {
    return document.querySelector(".slide.is-active") || slides[0];
  }

  function slideNumber(slide) {
    return slides.indexOf(slide) + 1;
  }

  function setEditMode(force) {
    editMode = typeof force === "boolean" ? force : !editMode;
    document.body.classList.toggle("edit-mode", editMode);
    toggleButton.setAttribute("aria-pressed", String(editMode));
    toggleButton.textContent = editMode ? "완료" : "편집";
    slides.forEach(slide => {
      slide.querySelectorAll("[data-editable]").forEach(el => {
        el.contentEditable = editMode ? "true" : "false";
        el.spellcheck = false;
      });
    });
    if (!editMode) {
      clearSelection();
      memoPanel.classList.remove("open");
      persist(false);
    }
  }

  function selectElement(el) {
    clearSelection();
    selected = el;
    selected.classList.add("is-selected");
    if (selected.matches("[data-editable]")) {
      const px = parseFloat(getComputedStyle(selected).fontSize);
      if (Number.isFinite(px)) fontSizeInput.value = String(Math.round(px));
    }
    if (selected.matches(".ppt-shape")) {
      strokeWidthInput.value = selected.dataset.strokeWidth || "3";
      strokeColorInput.value = selected.dataset.strokeColor || "#111111";
      rotationInput.value = selected.dataset.shapeType === "arrow" ? selected.dataset.rotation || "0" : "0";
    }
    renderMemoList();
  }

  function clearSelection() {
    document.querySelectorAll(".is-selected").forEach(el => el.classList.remove("is-selected"));
    selected = null;
  }

  function makeShape(type, data = {}) {
    const shape = document.createElement("div");
    const isMedia = type === "image" || type === "video";
    shape.className = `ppt-shape ${type === "memo" ? "memo-pin" : `${isMedia ? "media-frame " : ""}shape-${type}`}`;
    shape.dataset.shapeType = type;
    shape.dataset.shapeId = data.id || `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    shape.dataset.strokeWidth = String(data.strokeWidth || strokeWidthInput.value || 3);
    shape.dataset.strokeColor = data.strokeColor || strokeColorInput.value || "#111111";
    shape.dataset.note = data.note || "";
    shape.dataset.anchorId = data.anchorId || "";
    shape.dataset.anchorText = data.anchorText || "";
    shape.dataset.mediaId = data.mediaId || "";
    shape.dataset.fileName = data.fileName || "";
    shape.dataset.mime = data.mime || "";
    shape.dataset.fileSize = String(data.fileSize || 0);
    shape.dataset.rotation = String(data.rotation || 0);
    shape.style.left = data.left || (type === "memo" ? "52%" : isMedia ? "32%" : "38%");
    shape.style.top = data.top || (type === "memo" ? "36%" : isMedia ? "28%" : "42%");
    shape.style.width = data.width || (type === "video" ? "560px" : type === "image" ? "480px" : type === "arrow" ? "260px" : type === "memo" ? "34px" : "220px");
    shape.style.height = data.height || (type === "video" ? "315px" : type === "image" ? "300px" : type === "arrow" ? "56px" : type === "memo" ? "34px" : "130px");
    applyShapeAppearance(shape);

    if (isMedia) {
      const media = document.createElement(type === "image" ? "img" : "video");
      media.dataset.mediaContent = "";
      if (type === "image") media.alt = data.fileName || "첨부 이미지";
      if (type === "video") {
        media.controls = true;
        media.playsInline = true;
        media.preload = "metadata";
      }
      const placeholder = document.createElement("div");
      placeholder.className = "media-placeholder";
      placeholder.textContent = data.fileName ? `미디어 불러오는 중 · ${data.fileName}` : "미디어 파일을 선택하세요";
      shape.append(media, placeholder);
      if (data.blob) setMediaSource(shape, data.blob);
      else if (shape.dataset.mediaId) hydrateMediaShape(shape);
    } else if (type === "arrow") {
      shape.innerHTML = '<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><line x1="1" y1="15" x2="90" y2="15"></line><polygon points="82,5 100,15 82,25"></polygon></svg>';
      const rotateHandle = document.createElement("span");
      rotateHandle.className = "rotate-handle";
      rotateHandle.title = "드래그해서 회전";
      rotateHandle.setAttribute("aria-label", "화살표 회전 손잡이");
      shape.appendChild(rotateHandle);
    } else if (type === "memo") {
      shape.textContent = data.label || "M";
      shape.title = "부분 메모";
    }
    if (type !== "memo") {
      const handle = document.createElement("span");
      handle.className = "resize-handle";
      handle.setAttribute("aria-hidden", "true");
      shape.appendChild(handle);
    }
    bindShape(shape);
    return shape;
  }

  function setMediaSource(shape, blob) {
    const media = shape.querySelector("[data-media-content]");
    if (!media || !blob) return;
    const oldUrl = shape.dataset.objectUrl;
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
      liveMediaUrls.delete(oldUrl);
    }
    const objectUrl = URL.createObjectURL(blob);
    liveMediaUrls.add(objectUrl);
    shape.dataset.objectUrl = objectUrl;
    media.src = objectUrl;
    if (media.tagName === "VIDEO") media.load();
    shape.classList.add("has-media");
  }

  async function hydrateMediaShape(shape) {
    try {
      const blob = await loadMediaBlob(shape.dataset.mediaId);
      if (!shape.isConnected && !blob) return;
      if (blob) setMediaSource(shape, blob);
      else {
        const placeholder = shape.querySelector(".media-placeholder");
        if (placeholder) placeholder.textContent = `원본 파일 재첨부 필요 · ${shape.dataset.fileName || "미디어"}`;
      }
    } catch (error) {
      const placeholder = shape.querySelector(".media-placeholder");
      if (placeholder) placeholder.textContent = `미디어를 불러오지 못했습니다 · ${shape.dataset.fileName || error.message}`;
    }
  }

  function cleanupMediaShape(shape) {
    const objectUrl = shape?.dataset?.objectUrl;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      liveMediaUrls.delete(objectUrl);
    }
  }

  function applyShapeAppearance(shape) {
    shape.style.setProperty("--shape-stroke-width", `${shape.dataset.strokeWidth || 3}px`);
    shape.style.setProperty("--shape-stroke", shape.dataset.strokeColor || "#111111");
    shape.style.setProperty("--shape-rotation", `${shape.dataset.rotation || 0}deg`);
  }

  function bindShape(shape) {
    shape.addEventListener("pointerdown", event => {
      if (!editMode) return;
      event.stopPropagation();
      selectElement(shape);
      if (event.target.classList.contains("rotate-handle")) {
        event.preventDefault();
        beginRotate(event, shape);
      } else if (event.target.classList.contains("resize-handle")) {
        event.preventDefault();
        beginResize(event, shape);
      } else {
        beginDrag(event, shape);
      }
    });
    shape.addEventListener("dblclick", event => {
      if (!editMode || shape.dataset.shapeType !== "memo") return;
      event.stopPropagation();
      memoPanel.classList.add("open");
      renderMemoList(shape.dataset.shapeId);
    });
  }

  function beginDrag(event, shape) {
    actionInProgress = true;
    const slide = shape.closest(".slide");
    const rect = shape.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = rect.left - slideRect.left;
    const startTop = rect.top - slideRect.top;
    shape.setPointerCapture?.(event.pointerId);

    const move = e => {
      const left = Math.max(0, Math.min(slideRect.width - rect.width, startLeft + e.clientX - startX));
      const top = Math.max(0, Math.min(slideRect.height - rect.height, startTop + e.clientY - startY));
      shape.style.left = `${left}px`;
      shape.style.top = `${top}px`;
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      actionInProgress = false;
      if (shape.dataset.shapeType === "memo") updateMemoAnchor(shape);
      commit("도형 이동");
      renderMemoList(shape.dataset.shapeId);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
  }

  function beginResize(event, shape) {
    actionInProgress = true;
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = shape.offsetWidth;
    const startHeight = shape.offsetHeight;
    const move = e => {
      shape.style.width = `${Math.max(40, startWidth + e.clientX - startX)}px`;
      shape.style.height = `${Math.max(28, startHeight + e.clientY - startY)}px`;
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      actionInProgress = false;
      commit("도형 크기 변경");
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
  }

  function normalizeRotation(value) {
    const raw = Number(value) || 0;
    return ((raw + 180) % 360 + 360) % 360 - 180;
  }

  function setArrowRotation(value, shouldCommit = true) {
    if (!selected?.matches(".shape-arrow")) return;
    const rotation = Math.round(normalizeRotation(value));
    selected.dataset.rotation = String(rotation);
    rotationInput.value = String(rotation);
    applyShapeAppearance(selected);
    if (shouldCommit) commit("화살표 회전");
  }

  function adjustArrowRotation(delta) {
    if (!selected?.matches(".shape-arrow")) return;
    setArrowRotation(Number(selected.dataset.rotation || 0) + delta);
  }

  function beginRotate(event, shape) {
    actionInProgress = true;
    const rect = shape.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startPointerAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI;
    const startRotation = Number(shape.dataset.rotation || 0);
    shape.setPointerCapture?.(event.pointerId);
    const move = e => {
      const pointerAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      shape.dataset.rotation = String(Math.round(normalizeRotation(startRotation + pointerAngle - startPointerAngle)));
      rotationInput.value = shape.dataset.rotation;
      applyShapeAppearance(shape);
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      actionInProgress = false;
      commit("화살표 회전");
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
  }

  function addShape(type) {
    const layer = activeSlide().querySelector(".canvas-layer");
    if (!layer) return;
    const shape = makeShape(type);
    layer.appendChild(shape);
    if (type === "memo") updateMemoAnchor(shape);
    renumberMemoPins();
    selectElement(shape);
    if (type === "memo") {
      memoPanel.classList.add("open");
      renderMemoList(shape.dataset.shapeId);
    }
    commit(`${type} 추가`);
  }

  async function addMediaFile(type, file) {
    if (!file) return;
    const expected = type === "image" ? "image/" : "video/";
    if (file.type && !file.type.startsWith(expected)) {
      toast(type === "image" ? "이미지 파일을 선택해 주세요." : "동영상 파일을 선택해 주세요.");
      return;
    }
    const layer = activeSlide().querySelector(".canvas-layer");
    if (!layer) return;
    const mediaId = `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    saveStatus.textContent = `${file.name} 저장 중…`;
    try {
      await storeMediaBlob(mediaId, file);
      const shape = makeShape(type, {
        mediaId,
        fileName: file.name,
        mime: file.type,
        fileSize: file.size,
        blob: file
      });
      layer.appendChild(shape);
      selectElement(shape);
      commit(`${type === "image" ? "사진" : "동영상"} 추가`);
      toast(`${file.name}을(를) 추가했습니다. 드래그해서 이동하고 모서리로 크기를 조절하세요.`);
    } catch (error) {
      toast(`미디어 저장 실패: ${error.message}`);
    }
  }

  function renumberMemoPins() {
    slides.forEach(slide => {
      [...slide.querySelectorAll(".memo-pin")].forEach((pin, index) => {
        pin.textContent = `M${index + 1}`;
      });
    });
  }

  function updateMemoAnchor(pin) {
    const slide = pin.closest(".slide");
    if (!slide) return;
    const pinRect = pin.getBoundingClientRect();
    const x = pinRect.left + pinRect.width / 2;
    const y = pinRect.top + pinRect.height / 2;
    const candidates = [...slide.querySelectorAll("[data-editable]")]
      .map(el => ({ el, rect: el.getBoundingClientRect() }))
      .filter(item => item.rect.width > 0 && item.rect.height > 0);
    if (!candidates.length) return;
    const containing = candidates.find(item => x >= item.rect.left && x <= item.rect.right && y >= item.rect.top && y <= item.rect.bottom);
    const nearest = containing || candidates.reduce((best, item) => {
      const cx = item.rect.left + item.rect.width / 2;
      const cy = item.rect.top + item.rect.height / 2;
      const distance = Math.hypot(x - cx, y - cy);
      return !best || distance < best.distance ? { ...item, distance } : best;
    }, null);
    const target = nearest?.el;
    if (!target) return;
    pin.dataset.anchorId = target.dataset.editId || "";
    pin.dataset.anchorText = stripHtml(target.innerHTML).slice(0, 140);
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.matches(".ppt-shape")) {
      cleanupMediaShape(selected);
      selected.remove();
      selected = null;
      renumberMemoPins();
      renderMemoList();
      commit("도형 삭제");
    }
  }

  function adjustFont(delta) {
    if (!selected?.matches("[data-editable]")) return;
    const current = parseFloat(getComputedStyle(selected).fontSize) || 32;
    const next = Math.max(12, Math.min(180, current + delta));
    selected.style.fontSize = `${next}px`;
    fontSizeInput.value = String(Math.round(next));
    commit("글자 크기 변경");
  }

  function setFontSize(value) {
    if (!selected?.matches("[data-editable]")) return;
    const size = Math.max(12, Math.min(180, Number(value) || 32));
    selected.style.fontSize = `${size}px`;
    commit("글자 크기 변경");
  }

  function toggleBold() {
    if (!selected?.matches("[data-editable]")) return;
    const current = Number.parseInt(getComputedStyle(selected).fontWeight, 10) || 400;
    selected.style.fontWeight = current >= 650 ? "400" : "800";
    commit("글자 굵기 변경");
  }

  function updateSelectedShape() {
    if (!selected?.matches(".ppt-shape")) return;
    selected.dataset.strokeWidth = String(Math.max(1, Math.min(12, Number(strokeWidthInput.value) || 3)));
    selected.dataset.strokeColor = strokeColorInput.value;
    applyShapeAppearance(selected);
    commit("도형 선 변경");
  }

  function slideLayoutHtml(slide) {
    const copy = slide.cloneNode(true);
    copy.querySelectorAll(".ppt-shape").forEach(shape => shape.remove());
    copy.querySelectorAll(".is-selected").forEach(el => el.classList.remove("is-selected"));
    copy.querySelectorAll("[contenteditable]").forEach(el => el.removeAttribute("contenteditable"));
    return copy.innerHTML;
  }

  function slideClassName(slide) {
    return [...slide.classList]
      .filter(name => !["is-active", "is-prev"].includes(name))
      .join(" ");
  }

  function structureSignature(items) {
    return items.map(item => item.slideId || "").join("|");
  }

  function restoreSlideStructure(state) {
    const savedSlides = state.slides || [];
    const hasStableIds = savedSlides.every(item => item.slideId);
    if (!hasStableIds) {
      while (slides.length < savedSlides.length) {
        const slideState = savedSlides[slides.length];
        if (!slideState?.custom) break;
        deck.appendChild(createBlankSlide(slides.length, slideState.title || "새 슬라이드 제목"));
        initializeSlides();
      }
      return;
    }

    const currentSignature = structureSignature(slides.map(slide => ({ slideId: slide.dataset.slideId })));
    const savedSignature = structureSignature(savedSlides);
    if (currentSignature === savedSignature) return;

    const baseSlides = new Map(
      slides
        .filter(slide => slide.dataset.customSlide !== "true")
        .map(slide => [slide.dataset.slideId, slide])
    );
    const ordered = [];

    savedSlides.forEach((slideState, slideIndex) => {
      if (!slideState.custom) {
        const base = baseSlides.get(slideState.slideId);
        if (base) {
          ordered.push(base);
          baseSlides.delete(slideState.slideId);
        }
        return;
      }

      let slide;
      if (slideState.layoutHtml) {
        slide = document.createElement("section");
        slide.className = slideState.className || "slide";
        slide.classList.add("slide");
        slide.classList.remove("is-active", "is-prev");
        slide.innerHTML = slideState.layoutHtml;
      } else {
        slide = createBlankSlide(slideIndex, slideState.title || "새 슬라이드 제목");
      }
      slide.dataset.customSlide = "true";
      slide.dataset.slideId = slideState.slideId;
      slide.dataset.sourceSlideId = slideState.sourceSlideId || "";
      slide.dataset.title = slideState.title || "새 슬라이드";
      ordered.push(slide);
    });

    ordered.push(...baseSlides.values());

    // Place only new source slides; an already saved order remains user-owned.
    const specElement = document.getElementById("deck-revision");
    const insertions = new Map(
      (specElement ? JSON.parse(specElement.textContent).insertedSlides || [] : [])
        .map(item => [item.slideId, item.beforeSlideId])
    );
    const positioned = new Set();
    const positioning = new Set();
    function positionNewSlide(slideId) {
      if (!baseSlides.has(slideId) || !insertions.has(slideId) || positioned.has(slideId)) return;
      if (positioning.has(slideId)) return;
      const beforeSlideId = insertions.get(slideId);
      if (!beforeSlideId || beforeSlideId === slideId) return;
      positioning.add(slideId);
      positionNewSlide(beforeSlideId);
      const slide = baseSlides.get(slideId);
      const beforeSlide = ordered.find(item => item.dataset.slideId === beforeSlideId);
      if (beforeSlide) {
        ordered.splice(ordered.indexOf(slide), 1);
        ordered.splice(ordered.indexOf(beforeSlide), 0, slide);
      }
      positioning.delete(slideId);
      positioned.add(slideId);
    }
    insertions.forEach((_, slideId) => positionNewSlide(slideId));
    ordered.forEach(slide => deck.appendChild(slide));
    initializeSlides();
  }

  function stateFromDom() {
    return {
      version: 1,
      deckTitle: document.getElementById("deck-title")?.value || document.title,
      savedAt: new Date().toISOString(),
      mediaManifest: slides.flatMap((slide, slideIndex) => [...slide.querySelectorAll(".media-frame")].map(shape => ({
        slide: slideIndex + 1,
        id: shape.dataset.mediaId,
        type: shape.dataset.shapeType,
        fileName: shape.dataset.fileName,
        mime: shape.dataset.mime,
        fileSize: Number(shape.dataset.fileSize || 0)
      }))),
      slides: slides.map((slide, slideIndex) => ({
        index: slideIndex + 1,
        slideId: slide.dataset.slideId,
        sourceSlideId: slide.dataset.sourceSlideId || "",
        title: slide.dataset.title || `Slide ${slideIndex + 1}`,
        custom: slide.dataset.customSlide === "true",
        className: slideClassName(slide),
        layoutHtml: slide.dataset.customSlide === "true" ? slideLayoutHtml(slide) : "",
        edits: [...slide.querySelectorAll("[data-editable]")].map(el => ({
          id: el.dataset.editId,
          html: el.innerHTML,
          style: styleState(el)
        })),
        annotations: [...slide.querySelectorAll(".ppt-shape")].map(shape => ({
          id: shape.dataset.shapeId,
          type: shape.dataset.shapeType,
          left: shape.style.left,
          top: shape.style.top,
          width: shape.style.width,
          height: shape.style.height,
          strokeWidth: shape.dataset.strokeWidth,
          strokeColor: shape.dataset.strokeColor,
          note: shape.dataset.note || "",
          anchorId: shape.dataset.anchorId || "",
          anchorText: shape.dataset.anchorText || "",
          mediaId: shape.dataset.mediaId || "",
          fileName: shape.dataset.fileName || "",
          mime: shape.dataset.mime || "",
          fileSize: Number(shape.dataset.fileSize || 0),
          rotation: Number(shape.dataset.rotation || 0)
        }))
      }))
    };
  }

  function migrateSourceRevision(state) {
    const specElement = document.getElementById("deck-revision");
    if (!specElement) return state;
    const spec = JSON.parse(specElement.textContent);
    const next = JSON.parse(JSON.stringify(state));
      if (spec.deckTitle && next.deckTitle === spec.deckTitle.from) next.deckTitle = spec.deckTitle.to;
    next.slides = (next.slides || []).filter(s => !(spec.removedSlideIds || []).includes(s.slideId));
    for (const slideState of next.slides) {
      for (const change of spec.titleUpdates || []) {
        if (slideState.slideId === change.slideId && slideState.title === change.from) slideState.title = change.to;
      }
      for (const edit of slideState.edits || []) {
        for (const change of spec.textUpdates || []) {
          if (edit.id === change.editId && edit.html === change.from) edit.html = change.to;
        }
      }
      slideState.annotations = (slideState.annotations || []).filter(a => !(spec.resolvedMemoIds || []).includes(a.id));
    }
    return next;
  }

  function applyState(state) {
    if (!state || state.version !== 1 || !Array.isArray(state.slides)) throw new Error("지원하지 않는 변경 파일입니다.");
    state = migrateSourceRevision(state);
    restoreSlideStructure(state);
    state.slides.forEach((slideState, slideIndex) => {
      const slide = slideState.slideId
        ? slides.find(s => s.dataset.slideId === slideState.slideId) : slides[slideIndex];
      if (!slide) return;
      if (slideState.title) slide.dataset.title = slideState.title;
      const editableElements = [...slide.querySelectorAll("[data-editable]")];
      (slideState.edits || []).forEach((edit, editIndex) => {
        const el = edit.id
          ? slide.querySelector(`[data-edit-id="${CSS.escape(edit.id)}"]`) : editableElements[editIndex];
        if (!el) return;
        el.innerHTML = edit.html;
        Object.assign(el.style, edit.style || {});
      });
      const layer = slide.querySelector(".canvas-layer");
      if (!layer) return;
      layer.querySelectorAll(".ppt-shape").forEach(shape => {
        cleanupMediaShape(shape);
        shape.remove();
      });
      (slideState.annotations || []).forEach(data => layer.appendChild(makeShape(data.type, data)));
      slide.querySelectorAll(".memo-pin").forEach(pin => {
        const anchorExists = pin.dataset.anchorId && slide.querySelector(`[data-edit-id="${CSS.escape(pin.dataset.anchorId)}"]`);
        if (!anchorExists) updateMemoAnchor(pin);
      });
    });
    renumberMemoPins();
    clearSelection();
    renderMemoList();
  }

  function snapshot() {
    return JSON.stringify(stateFromDom());
  }

  function commit(label = "변경") {
    window.clearTimeout(saveTimer);
    saveStatus.textContent = `${label} 저장 중…`;
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      const next = snapshot();
      if (history[historyIndex] !== next) {
        history = history.slice(0, historyIndex + 1);
        history.push(next);
        if (history.length > 40) history.shift();
        historyIndex = history.length - 1;
      }
      persist(false);
    }, 220);
  }

  function persist(showToast = true) {
    const state = stateFromDom();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.textContent = `저장됨 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
    if (showToast) toast("변경 내용을 저장했습니다.");
  }

  function undo() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      const current = snapshot();
      if (history[historyIndex] !== current) {
        history = history.slice(0, historyIndex + 1);
        history.push(current);
        historyIndex = history.length - 1;
      }
    }
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    applyState(JSON.parse(history[historyIndex]));
    persist(false);
    toast("이전 변경으로 돌아갔습니다.");
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    applyState(JSON.parse(history[historyIndex]));
    persist(false);
    toast("변경을 다시 적용했습니다.");
  }

  function exportState() {
    const state = stateFromDom();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `academic-deck-changes-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    persist(false);
    toast("변경 파일을 내려받았습니다. 미디어가 있다면 JSON과 원본 사진·동영상도 함께 첨부하세요.");
  }

  async function importState(file) {
    const text = await file.text();
    const state = JSON.parse(text);
    applyState(state);
    history = [snapshot()];
    historyIndex = 0;
    persist(false);
    toast("변경 파일을 불러왔습니다.");
  }

  function memoEntries() {
    return slides.flatMap((slide, slideIndex) => [...slide.querySelectorAll(".memo-pin")].map((pin, noteIndex) => ({
      pin,
      slideIndex,
      noteIndex,
      title: slide.dataset.title || `Slide ${slideIndex + 1}`,
      note: pin.dataset.note || "",
      left: pin.style.left,
      top: pin.style.top,
      anchorId: pin.dataset.anchorId || "",
      anchorText: pin.dataset.anchorText || ""
    })));
  }

  function renderMemoList(activeId = selected?.dataset?.shapeId) {
    const entries = memoEntries();
    memoList.innerHTML = "";
    if (!entries.length) {
      memoList.innerHTML = '<div class="memo-empty">메모가 없습니다. 편집 모드에서 “● 메모”를 눌러 특정 위치에 메모를 추가하세요.</div>';
      return;
    }
    entries.forEach(entry => {
      const item = document.createElement("div");
      item.className = `memo-item${entry.pin.dataset.shapeId === activeId ? " is-active" : ""}`;
      item.dataset.shapeId = entry.pin.dataset.shapeId;
      const anchor = entry.anchorText ? `대상: ${entry.anchorText}` : "대상: 슬라이드의 가장 가까운 요소";
      item.innerHTML = `<div class="memo-item-head"><strong>${entry.slideIndex + 1}. ${escapeHtml(entry.title)} · M${entry.noteIndex + 1}</strong><span>${escapeHtml(entry.left)}, ${escapeHtml(entry.top)}</span></div><div class="memo-anchor">${escapeHtml(anchor)}</div><textarea placeholder="예: 이 수치를 실제 분석값으로 교체 / 타원을 조금 더 크게">${escapeHtml(entry.note)}</textarea>`;
      item.addEventListener("click", event => {
        if (event.target.tagName === "TEXTAREA") return;
        location.hash = `#/${entry.slideIndex + 1}`;
        selectElement(entry.pin);
      });
      item.querySelector("textarea").addEventListener("input", event => {
        entry.pin.dataset.note = event.target.value;
        commit("메모 변경");
      });
      memoList.appendChild(item);
    });
  }

  function buildCodexSummary() {
    const state = stateFromDom();
    const lines = [
      `# ${state.deckTitle} 수정 요청`,
      "",
      `저장 시각: ${new Date(state.savedAt).toLocaleString("ko-KR")}`,
      "",
      "## 바꾼 텍스트"
    ];
    let changeCount = 0;
    state.slides.forEach(slide => {
      const changed = slide.edits.filter(edit => {
        const base = baseline.get(edit.id);
        return base && (base.html !== edit.html || JSON.stringify(base.style) !== JSON.stringify(edit.style));
      });
      if (!changed.length) return;
      lines.push(``, `### ${slide.index}. ${slide.title}`);
      changed.forEach(edit => {
        changeCount += 1;
        lines.push(`- ${edit.id}: ${stripHtml(edit.html)}`);
      });
    });
    if (!changeCount) lines.push("- 직접 바꾼 텍스트 없음");
    lines.push("", "## 위치 메모");
    const memos = memoEntries();
    if (!memos.length) lines.push("- 메모 없음");
    memos.forEach(entry => lines.push(`- 슬라이드 ${entry.slideIndex + 1} “${entry.title}” M${entry.noteIndex + 1} (${entry.left}, ${entry.top}), 대상 ${entry.anchorId || "미지정"} “${entry.anchorText || "가까운 요소"}”: ${entry.note || "[내용 미입력]"}`));
    lines.push("", "## 첨부 미디어");
    if (!state.mediaManifest.length) lines.push("- 미디어 없음");
    state.mediaManifest.forEach(media => lines.push(`- 슬라이드 ${media.slide}: ${media.fileName} (${media.type}, ${media.mime || "형식 미상"}, ${media.fileSize} bytes)`));
    lines.push("", "첨부한 academic-deck-changes JSON, 위 메모, 원본 미디어 파일을 반영해 HTML 발표자료를 수정해 주세요.");
    return lines.join("\n");
  }

  async function copySummary() {
    const summary = buildCodexSummary();
    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      const area = document.createElement("textarea");
      area.value = summary;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    toast("Codex에 붙여넣을 수정 요약을 복사했습니다.");
  }

  function stripHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return (temp.textContent || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  }

  function toast(message) {
    document.querySelector(".toast")?.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function runCommand(command) {
    ({
      undo,
      redo,
      "font-minus": () => adjustFont(-2),
      "font-plus": () => adjustFont(2),
      bold: toggleBold,
      rectangle: () => addShape("rectangle"),
      ellipse: () => addShape("ellipse"),
      arrow: () => addShape("arrow"),
      image: () => imageFile.click(),
      video: () => videoFile.click(),
      "new-slide": duplicateCurrentSlide,
      "rotate-left": () => adjustArrowRotation(-15),
      "rotate-right": () => adjustArrowRotation(15),
      memo: () => addShape("memo"),
      delete: deleteSelected,
      save: () => persist(true),
      export: exportState,
      "memo-panel": () => { memoPanel.classList.toggle("open"); renderMemoList(); },
      "close-memo-panel": () => memoPanel.classList.remove("open"),
      "copy-summary": copySummary
    })[command]?.();
  }

  toggleButton.addEventListener("click", () => setEditMode());
  document.addEventListener("click", event => {
    const commandButton = event.target.closest("[data-command]");
    if (commandButton) {
      event.preventDefault();
      runCommand(commandButton.dataset.command);
      return;
    }
    if (!editMode || toolbar.contains(event.target) || memoPanel.contains(event.target)) return;
    const editable = event.target.closest("[data-editable]");
    const shape = event.target.closest(".ppt-shape");
    if (editable) selectElement(editable);
    else if (shape) selectElement(shape);
    else clearSelection();
  });
  document.addEventListener("input", event => {
    if (editMode && event.target.matches("[data-editable]")) commit("텍스트 변경");
  });
  fontSizeInput.addEventListener("change", () => setFontSize(fontSizeInput.value));
  strokeWidthInput.addEventListener("change", updateSelectedShape);
  strokeColorInput.addEventListener("input", updateSelectedShape);
  rotationInput.addEventListener("input", () => {
    if (/^-?\d+(?:\.\d+)?$/.test(rotationInput.value.trim())) {
      setArrowRotation(rotationInput.value, false);
    }
  });
  rotationInput.addEventListener("change", () => setArrowRotation(rotationInput.value));
  importFile.addEventListener("change", () => {
    const file = importFile.files?.[0];
    if (!file) return;
    importState(file).catch(error => toast(`가져오기 실패: ${error.message}`));
    importFile.value = "";
  });
  imageFile.addEventListener("change", () => {
    const file = imageFile.files?.[0];
    if (file) addMediaFile("image", file);
    imageFile.value = "";
  });
  videoFile.addEventListener("change", () => {
    const file = videoFile.files?.[0];
    if (file) addMediaFile("video", file);
    videoFile.value = "";
  });

  document.addEventListener("keydown", event => {
    const typing = event.target.matches("input, textarea, [contenteditable='true']");
    if (!typing && (event.key === "e" || event.key === "E")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setEditMode();
      return;
    }
    if (!editMode) return;
    if (event.ctrlKey && event.key.toLowerCase() === "z") {
      event.preventDefault(); event.stopImmediatePropagation();
      event.shiftKey ? redo() : undo();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "y") {
      event.preventDefault(); event.stopImmediatePropagation(); redo(); return;
    }
    if (!typing && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault(); event.stopImmediatePropagation(); deleteSelected(); return;
    }
    // Edit mode owns every remaining key event. Text inputs keep their normal
    // browser behavior, but presentation shortcuts must never see the event.
    event.stopImmediatePropagation();
    if (!typing && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter", "PageUp", "PageDown", "Home", "End", "Backspace"].includes(event.key)) {
      event.preventDefault();
    }
  }, true);

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const revision = document.getElementById("deck-revision");
      if (revision) {
        const backupKey = `${STORAGE_KEY}:before:${JSON.parse(revision.textContent).id}`;
        if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, saved);
      }
      applyState(JSON.parse(saved));
    }
  } catch (error) {
    console.warn("Saved deck state could not be restored", error);
  }
  history = [snapshot()];
  historyIndex = 0;
  const resumeEdit = sessionStorage.getItem(`${STORAGE_KEY}:resume-edit`) === "1";
  sessionStorage.removeItem(`${STORAGE_KEY}:resume-edit`);
  setEditMode(resumeEdit);
  renderMemoList();
  window.addEventListener("beforeunload", () => {
    liveMediaUrls.forEach(url => URL.revokeObjectURL(url));
    liveMediaUrls.clear();
  });

  window.academicDeckEditor = {
    exportState: stateFromDom,
    applyState,
    getSummary: buildCodexSummary,
    setEditMode
  };
})();
