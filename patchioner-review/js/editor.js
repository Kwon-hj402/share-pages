(() => {
  "use strict";

  const STORAGE_KEY = `academic-html-ppt:patchioner-content-v3:${location.pathname}`;
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
        const id = `${slide.dataset.slideId}-e${editIndex + 1}`;
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
    const scale = slideRect.width / slide.offsetWidth;
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = rect.left - slideRect.left;
    const startTop = rect.top - slideRect.top;
    shape.setPointerCapture?.(event.pointerId);

    const move = e => {
      const left = Math.max(0, Math.min(slideRect.width - rect.width, startLeft + e.clientX - startX));
      const top = Math.max(0, Math.min(slideRect.height - rect.height, startTop + e.clientY - startY));
      shape.style.left = `${left / scale}px`;
      shape.style.top = `${top / scale}px`;
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
    const scale = shape.closest(".slide").getBoundingClientRect().width / shape.closest(".slide").offsetWidth;
    const startWidth = shape.offsetWidth;
    const startHeight = shape.offsetHeight;
    const move = e => {
      shape.style.width = `${Math.max(40, startWidth + (e.clientX - startX) / scale)}px`;
      shape.style.height = `${Math.max(28, startHeight + (e.clientY - startY) / scale)}px`;
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
    const freshBaseOrder = [...baseSlides.keys()];
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

    // Insert new source slides next to their fresh-deck anchors, retaining custom slides.
    baseSlides.forEach((slide, id) => {
      const sourceIndex = freshBaseOrder.indexOf(id);
      const nextIndex = ordered.findIndex(item => {
        const index = freshBaseOrder.indexOf(item.dataset.slideId);
        return index > sourceIndex;
      });
      if (nextIndex < 0) ordered.push(slide);
      else ordered.splice(nextIndex, 0, slide);
    });
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

  // Update unchanged source copy without discarding personal edits or annotations.
  const phraseStyleChanges = {"content-v3-02": [["<b>Whole-image captioning</b>은 사진 전체를 요약하므로, 사용자가 원하는 작은 영역을 중심으로 설명하기 어렵다.", "기존 <b>Whole-image captioning</b>: 사진 전체 요약 → <b>사용자가 원하는 영역의 설명 어려움</b>"], ["<b>Region-level captioning</b>을 직접 학습하려면, 영역의 위치와 그 영역을 설명하는 정답 문장을 짝지은 데이터가 필요하다.", "<b>Region-level captioning</b> 직접 학습 → <b>영역 위치–정답 문장 쌍</b>으로 구성된 학습 데이터 필요"], ["사진마다 다양한 영역과 조합의 캡션을 작성해야 하므로, <b>annotation 비용이 크고 새로운 영역 형태로 확장하기 어렵다.</b>", "다양한 영역·조합마다 정답 캡션 작성 → <b>Annotation 비용 증가 + 새로운 영역 형태로의 확장 부담</b>"]], "content-v3-03": [["이미지 전체 대신 <b>Patch를 설명의 기본 단위</b>로 사용한다.", "설명의 기본 단위: <b>Whole image → Patch</b>"], ["선택한 Patch의 특징을 모으면, 작은 영역부터 이미지 전체까지 <b>같은 Captioning pipeline</b>으로 처리할 수 있다.", "선택한 Patch features 집계 → 작은 영역부터 이미지 전체까지 <b>하나의 Captioning pipeline으로 처리</b>"]], "content-v3-04": [["<b>Unified patch-centric framework:</b> 개별 Patch, 사각형 영역, 떨어진 여러 영역과 이미지 전체를 하나의 구조로 설명한다.", "<b>Unified patch-centric framework</b><br>개별 Patch·사각형·영역 집합·전체 이미지 → 하나의 설명 구조로 통합"], ["<b>Zero-shot regional captioning:</b> Frozen backbone과 Text-only decoder를 연결하여, 영역–문장 쌍으로 직접 학습하지 않고 영역 설명을 생성한다.", "<b>Zero-shot regional captioning</b><br>Frozen backbone + Text-only decoder → 영역–문장 쌍의 직접 학습 없이 영역 설명"], ["<b>Component analysis and evaluation:</b> Backbone, 특징 집계와 Modality-gap 완화를 분석하고, 새로 제안한 Trace captioning을 포함한 네 과제에서 평가한다.", "<b>Component analysis and evaluation</b><br>Backbone·Aggregation·Modality gap 분석 + 새 Trace captioning을 포함한 네 과제 평가"]], "content-v3-05": [["이미지와 문장의 전체 의미를 연결한다.", "이미지–문장의 Global 의미 연결"], ["Global alignment만으로는 작은 Patch의 의미가 충분히 보존되지 않는다.", "Global alignment 중심 → Patch-level 의미 보존의 한계"], ["이미지의 위치별 시각 특징을 추출한다.", "이미지의 위치별 시각 특징 추출"], ["시각 특징을 텍스트의 의미와 연결해야 한다.", "Local features의 강점 → Language alignment 필요"], ["CLIP 텍스트 특징을 DINOv2 특징 공간으로 변환한다.", "CLIP text features → DINOv2 특징 공간으로 변환"], ["이미지 Patch와 문장의 특징을 같은 공간에서 비교할 수 있게 한다.", "공통 특징 공간 → Image patch와 Text의 의미 비교"], ["논문은 이 조합 외에도 DINO.txt, SigLIP2, DenseCLIP 등 여러 Backbone을 비교한다.", "비교 대상: CLIP·DINOv2 기반 모델 외 DINO.txt, SigLIP2, DenseCLIP 등"]], "content-v3-06": [["<b>DeCap·CapDec·CLOSE</b>는 텍스트 특징에서 문장을 복원하도록 Decoder를 학습하고, 이미지 특징을 입력할 때의 차이를 보완한다.", "<b>DeCap·CapDec·CLOSE</b>: 텍스트 특징 → 원래 문장 복원 학습<br>이미지 특징 사용 시 → Image–Text 입력 차이 보완"], ["기존 Zero-shot captioner는 주로 <b>Global image representation</b>을 사용하므로, 지정한 작은 영역의 특징을 직접 반영하기 어렵다.", "기존 Zero-shot captioner: <b>Global image representation</b> 중심 → 지정한 작은 영역의 특징 반영에 한계"], ["Patch-ioner는 <b>지역 의미가 풍부한 Patch features</b>를 기존 디코딩 방식에 연결하여, 설명할 영역을 선택할 수 있게 한다.", "Patch-ioner: <b>Local semantics가 풍부한 Patch features + 기존 Decoder</b> → 사용자가 선택한 영역의 설명"]], "content-v3-07": [["사전학습된 모델을 고정한다.", "Pretrained model 고정"], ["이미 학습된 연결을 고정한다.", "Pretrained mapping 고정"], ["텍스트 특징에서 원래 문장을 복원하도록 학습한다.", "Text features → 원래 문장 복원 학습"], ["<b>학습되는 것은 모델의 Parameters</b>이며, Feature vector는 각 입력을 모델에 통과시켜 계산한 결과다.", "<b>Parameters = 학습 대상</b> / Feature vector = 각 입력을 모델에 통과시킨 계산 결과"]], "content-v3-08": [["<b>V와 T는 출처가 다르지만</b>, 같은 DINOv2 특징 공간에서 의미를 비교하도록 연결되어 있다.", "<b>서로 다른 출처의 V와 T</b> → 공통 DINOv2 특징 공간에서 의미 비교"], ["Talk2DINO를 거친 T는 <b>텍스트에서 얻어 변환한 특징</b>이며, 사진에서 직접 추출한 특징은 아니다.", "<b>V:</b> 이미지 Patch에서 추출<br><b>T:</b> 텍스트 특징을 Talk2DINO로 변환"]], "content-v3-09": [["문장을 CLIP과 Talk2DINO로 변환한 <b>T를 입력</b>하고, 원래 문장의 Token을 정답으로 사용한다.", "문장 → CLIP + Talk2DINO → <b>학습 입력 T</b><br>원래 문장의 Token → <b>Target</b>"], ["인코더는 고정하고 <b>Text decoder의 Parameters만 학습</b>한다. 이 과정에는 사진이나 영역별 정답이 들어가지 않는다.", "Encoder 고정 + <b>Text decoder만 학습</b><br>사진·영역별 정답 없이 텍스트만 사용"]], "content-v3-10": [["Memory는 여러 문장을 <b>DINOv2 공간의 T 벡터로 변환하여 저장</b>한 자료다.", "여러 문장 → <b>DINOv2 공간의 T 벡터</b>로 변환 → Memory에 저장"], ["새로운 모델을 학습하는 과정이 아니다. 이후 이미지와 비교하여 <b>Decoder 입력을 구성하는 데 사용</b>한다.", "별도 모델 학습 없이 특징 계산·저장<br>이후 이미지와 비교 → <b>Decoder 입력 구성</b>"]], "content-v3-11": [["DINOv2로 <b>전체 이미지의 Patch features를 한 번 추출</b>한 뒤, 지정한 영역에 속하는 Patch를 선택한다.", "DINOv2로 <b>전체 이미지의 Patch features를 한 번 추출</b> → 지정한 영역의 Patch 선택"], ["선택한 특징의 평균으로 <b>영역 대표 벡터 V</b>를 계산한다. 이 집계에는 별도 학습 파라미터가 없다.", "선택한 특징의 평균 → <b>영역 대표 벡터 V</b><br>Parameter-free aggregation: 별도 집계 학습 없음"], ["V는 여전히 이미지에서 얻은 특징이며, <b>평균만으로 텍스트 특징으로 바뀌지는 않는다.</b>", "평균 후에도 V는 <b>이미지 유래 특징</b> → Decoder 입력 차이를 보완하는 과정 필요"]], "content-v3-12": [["이미지 특징 V와 텍스트 특징 T는 같은 공간에 있지만, <b>서로 다른 분포</b>에 놓일 수 있다.", "공통 특징 공간의 V와 T → <b>이미지·텍스트 간 분포 차이 가능</b> (Modality gap)"], ["T로 학습한 Decoder에 V를 바로 넣으면, 학습 때와 다른 입력 때문에 <b>부정확한 문장이나 Hallucination</b>이 발생할 수 있다.", "T로 학습한 Decoder에 V 입력 → 학습 시 입력과의 차이 → <b>부정확한 설명·Hallucination 가능성</b>"], ["추론 시, 유사한 T 벡터들의 가중합으로 입력을 구성한다.", "Inference: 유사한 T 벡터의 가중합 → Decoder 입력 구성"], ["학습 시, 텍스트 특징에 교란을 주어 입력 변화에 대응하게 한다.", "Training: 텍스트 특징에 Noise 추가 → 입력 변화에 대한 대응 학습"], ["시각 특징을 텍스트 특징 분포에 가깝게 점진적으로 보정한다.", "시각 특징의 단계적 보정 → 텍스트 특징 분포에 접근"]], "content-v3-13": [["<b>내적의 출력은 유사도 점수</b>다. Softmax는 점수를 벡터들을 섞을 비중으로 바꾼다.", "내적 → <b>Similarity scores</b><br>Softmax → 합이 1인 혼합 비중"], ["그 비중에 따라 T들을 합친 <b>Z를 Decoder에 전달</b>한다. 비중은 이미지마다 계산되며, 모델을 다시 학습하지 않는다.", "T들의 가중합 → <b>Z → Decoder</b><br>이미지마다 비중 계산 / 모델 재학습 없음"]], "content-v3-14": [["이미지의 선택 영역을 대표하는 <b>V</b>와, 미리 준비한 <b>Memory</b>를 비교한다.", "선택 영역의 <b>V</b> ↔ 미리 준비한 <b>Memory</b><br>유사도에 따른 T 벡터 가중합"], ["Memory에서 계산한 <b>Z</b>를 학습된 생성기에 넣어 문장을 만든다. 이 추론 과정에서는 <b>모델 Parameters를 갱신하지 않는다.</b>", "<b>Z → Trained decoder → Caption</b><br>Inference 중 모델 Parameters 고정"]], "content-v3-15": [["Decoder는 Z를 힌트로 받아 <b>다음 Token의 확률</b>을 계산하고, Token을 순서대로 생성한다.", "Z를 생성 힌트로 사용 → <b>다음 Token 확률 계산</b> → Token 순차 생성"], ["최종 출력은 벡터가 아닌 <b>실제 문장</b>이다.", "Token 누적 + 종료 표시 → <b>최종 Caption</b>"]], "content-v3-16": [["원래 문장을 복원하도록 Decoder를 학습한다.", "원래 문장 복원을 위한 Decoder 학습"], ["학습된 Decoder로 새로운 Caption을 생성한다.", "Trained decoder로 새로운 Caption 생성"], ["<b>Patch mean</b>은 선택한 이미지 위치들의 특징을 합쳐 V를 만든다.", "<b>Patch mean:</b> 선택 위치들의 이미지 특징 집계 → V"], ["<b>Memory projection</b>은 텍스트 유래 특징들을 합쳐, Decoder에 넣을 Z를 만든다.", "<b>Memory projection:</b> 텍스트 유래 특징의 가중합 → Decoder 입력 Z"]], "content-v3-17": [["사진에서 Patch features를 추출한다.", "Image → Patch features 추출"], ["사전학습 모델을 고정한다.", "Pretrained model 고정"], ["문장을 DINOv2 공간의 특징으로 변환한다.", "Text → DINOv2 공간의 특징 변환"], ["특징 벡터에서 문장을 생성한다.", "Feature vector → Caption 생성"], ["텍스트만으로 학습한다.", "Text-only training"], ["각 이미지·문장에서 추출한 특징이다.", "각 이미지·문장에서 추출한 특징"], ["입력을 넣어 계산한다.", "모델에 입력 → 특징 계산"], ["T 벡터를 모아둔 저장소다.", "T 벡터의 저장소"], ["미리 계산하여 저장한다.", "사전 계산·저장"], ["현재 V에 따른 점수와 혼합 비중이다.", "현재 V에 따른 유사도와 혼합 비중"], ["입력마다 계산한다.", "입력마다 계산"], ["T 벡터들의 가중합으로 만든 입력이다.", "T 벡터의 가중합 → Decoder 입력"]], "content-v3-18": [["선택한 Patch 집합만 바꾸어, 서로 다른 크기와 형태의 영역을 동일한 구조로 설명한다.", "선택한 Patch 집합 변경 → 다양한 크기·형태의 영역을 <b>동일한 구조로 설명</b>"]], "content-v3-19": [["Dense 평가에서는 <b>Ground-truth boxes를 제공</b>하므로, 영역 탐지 성능은 평가하지 않는다.", "Dense 평가: <b>Ground-truth boxes 제공 → Caption 생성 성능 측정</b> / 영역 탐지 평가는 제외"]], "content-v3-20": [["Trace benchmark는 마우스 궤적과 음성 설명을 가공했으며, <b>14,283 COCO captions와 26,614 Flickr30K captions</b>를 포함한다.", "마우스 궤적 + 음성 설명 가공 → Trace benchmark<br><b>COCO 14,283 captions / Flickr30K 26,614 captions</b>"]], "content-v3-21": [["생성 문장과 Reference captions의 단어·구문 일치도를 평가한다.", "생성 문장 ↔ Reference captions의 단어·구문 일치도"], ["이미지·텍스트 표현을 활용해 의미적 일치도를 평가한다.", "이미지·텍스트 표현에 기반한 의미적 일치도"], ["Ground-truth boxes를 제공한 Dense captioning 조건에서 보고한다.", "GT boxes를 제공한 Dense captioning 성능"], ["Whole-image task에서 이미지와 생성 문장의 정렬을 평가한다.", "Whole-image task의 Image–Caption alignment"], ["비교에는 기존 Zero-shot captioner, Crop 기반 변형, RegionCLIP·AlphaCLIP 조합이 포함된다.", "비교 조건: 기존 Zero-shot captioner + Crop 기반 변형 + RegionCLIP·AlphaCLIP 조합"]], "content-v3-22": [["같은 Decoder 설정에서 비교했을 때, DINOv2 기반 모델이 지역 설명 과제에서 더 높은 점수를 보였다.", "동일한 Decoder 설정의 Backbone 비교 → <b>DINOv2 기반 모델의 Regional captioning 점수 우위</b>"]], "content-v3-23": [["Talk2DINO의 CIDEr는 세 지역 과제 모두에서 CLIP보다 높았으며, Patch-level 의미 표현의 중요성을 보여준다.", "세 지역 과제의 CIDEr: <b>Talk2DINO > CLIP</b> → Patch-level 의미 표현의 중요성 뒷받침"]], "content-v3-25": [["Memory 조합은 Dense mAP에서, Diffusion 조합은 제시한 Trace·Region-set CIDEr에서 가장 높은 값을 보였다.", "제시한 과제·지표의 최고값: <b>Dense mAP → Memory</b> / <b>Trace·Region-set CIDEr → Diffusion</b>"]], "content-v3-26": [["전체 이미지 설명에서도 경쟁력은 유지했지만, COCO CIDEr는 MERCap과 EntroCap보다 낮았다.", "Whole-image captioning에서도 경쟁력 유지<br>단, <b>COCO CIDEr: MERCap·EntroCap > Patch-ioner</b>"]], "content-v3-28": [["좋은 <b>Local features</b>와 텍스트 디코딩을 연결하면, 영역별 캡션으로 직접 학습하지 않아도 지정한 부분을 설명할 수 있다.", "<b>Local features + Text decoding</b> → 영역별 정답 캡션의 직접 학습 없이 지정 영역 설명"], ["영역의 형태에 맞춰 <b>선택할 Patch 집합만 변경</b>하므로, 사각형·영역 집합·마우스 궤적을 하나의 구조로 다룰 수 있다.", "<b>선택할 Patch 집합만 변경</b> → 사각형·영역 집합·마우스 궤적을 하나의 구조로 처리"], ["한 번 추출한 이미지 특징을 여러 영역에 재사용할 수 있어, <b>사용자가 설명 위치를 바꾸는 인터랙티브 응용</b>에 적합한 구조다.", "한 번 추출한 이미지 특징을 여러 영역에 재사용 → <b>설명 위치를 바꾸는 인터랙티브 응용에 활용 가능</b>"]], "content-v3-29": [["<b>Supervised models:</b> 영역 정답자료로 직접 학습한 과제별 모델보다 성능이 낮을 수 있다.", "<b>Supervised models:</b> 영역 정답자료로 학습한 Task-specific model 대비 성능 격차"], ["<b>Context control:</b> Patch가 담는 주변 맥락을 사용자 의도에 맞춰 조절하지 못해, 선택 영역 밖의 내용을 언급할 수 있다.", "<b>Context control:</b> Patch의 맥락 범위 고정 → 선택 영역 밖의 내용까지 언급할 가능성"], ["<b>Hallucination:</b> Modality gap과 생성 과정의 불확실성 때문에 사진에 없는 내용을 말할 수 있다.", "<b>Hallucination:</b> Modality gap + 생성의 불확실성 → 사진에 없는 내용의 생성 가능성"], ["<b>Evaluation scope:</b> Dense 실험은 정답 박스를 제공하며, 자동 영역 탐지까지 포함한 성능을 보여주지는 않는다.", "<b>Evaluation scope:</b> Dense 실험에서 GT boxes 제공 → 자동 영역 탐지까지의 성능은 미검증"]], "content-v3-30": [["Patch-ioner는 <b>Patch를 기본 단위로 삼아</b> 작은 영역부터 이미지 전체까지 설명하는 Zero-shot captioning 구조를 제안했다.", "<b>Patch를 기본 단위로 설정</b> → 작은 영역부터 전체 이미지까지 통합한 Zero-shot captioning"], ["<b>Language-aligned local features</b>와 Modality-gap 보완을 통해, 텍스트만으로 학습한 Decoder를 영역 설명에 적용했다.", "<b>Language-aligned local features + Modality-gap 보완</b> → Text-only decoder의 Regional captioning 적용"], ["실험에서는 <b>Regional captioning의 성능 개선</b>을 보였으며, 전체 이미지 성능과 설명의 사실성에는 한계가 남았다.", "<b>Regional captioning 성능 개선</b><br>남은 과제: Whole-image 성능 격차 + 생성 설명의 사실성"]]};
  function updatePhraseStyle(state) {
    for (const slide of state.slides || []) {
      if (slide.custom) continue;
      const pairs = phraseStyleChanges[slide.slideId] || [];
      for (const edit of slide.edits || []) {
        for (const [before, after] of pairs) {
          if (edit.html === before) edit.html = after;
        }
      }
    }
  }

  function applyState(state) {
    if (!state || state.version !== 1 || !Array.isArray(state.slides)) throw new Error("지원하지 않는 변경 파일입니다.");
    updatePhraseStyle(state);
    restoreSlideStructure(state);
    state.slides.forEach((slideState, slideIndex) => {
      const slide = slideState.slideId
        ? slides.find(item => item.dataset.slideId === slideState.slideId)
        : slides[slideIndex];
      if (!slide) return;
      if (slideState.title) slide.dataset.title = slideState.title;
      const editableElements = [...slide.querySelectorAll("[data-editable]")];
      (slideState.edits || []).forEach((edit, editIndex) => {
        const el = slide.querySelector(`[data-edit-id="${CSS.escape(edit.id)}"]`) || editableElements[editIndex];
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
  fontSizeInput.addEventListener("input", () => setFontSize(fontSizeInput.value));
  strokeWidthInput.addEventListener("change", updateSelectedShape);
  strokeWidthInput.addEventListener("input", updateSelectedShape);
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
      const previous = JSON.parse(saved);
      const phraseBackupKey = STORAGE_KEY + ':before-phrase-style-20260922';
      if (!localStorage.getItem(phraseBackupKey)) localStorage.setItem(phraseBackupKey, saved);
      if (previous.slides?.some(s => s.slideId === 'patch-14') &&
          !previous.slides?.some(s => s.slideId === 'method-models')) {
        const archiveKey = STORAGE_KEY + ':before-methods-20260922';
        if (!localStorage.getItem(archiveKey)) localStorage.setItem(archiveKey, saved);
      }
      applyState(previous);
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
