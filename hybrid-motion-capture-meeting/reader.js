document.querySelectorAll('.film').forEach(figure => {
  const video=figure.querySelector('video');
  const button=figure.querySelector('.play-control');
  const status=figure.querySelector('.media-status');
  if(!video||!button)return;
  button.addEventListener('click', async()=>{
    if(!video.paused){video.pause();return;}
    if(video.ended)video.currentTime=0;
    try{await video.play();status.textContent='';}
    catch(error){status.textContent='재생할 수 없으면 아래 영상 파일 열기를 이용해 주세요.';}
  });
  video.addEventListener('play',()=>{button.textContent='일시정지';button.setAttribute('aria-label',figure.id+' 영상 일시정지');});
  video.addEventListener('pause',()=>{button.textContent='영상 재생';button.setAttribute('aria-label',figure.id+' 영상 재생');});
  video.addEventListener('error',()=>{status.textContent='영상 파일을 불러오지 못했습니다. 영상 파일 열기를 이용해 주세요.';});
});

// Keep the document images in place; the original source opens in a separate viewer.
(() => {
  const pictures = document.querySelectorAll('.document figure img:not(.print-still):not(.logo)');
  if (!pictures.length || document.getElementById('reader-image-viewer')) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'reader-image-viewer';
  dialog.className = 'image-viewer';
  dialog.setAttribute('aria-labelledby', 'reader-image-viewer-title');
  dialog.innerHTML = `
    <div class="image-viewer-shell">
      <div class="image-viewer-header">
        <h2 id="reader-image-viewer-title">이미지 크게 보기</h2>
        <button type="button" class="image-viewer-close" aria-label="이미지 확대 창 닫기">닫기 <span aria-hidden="true">×</span></button>
      </div>
      <div class="image-viewer-toolbar" aria-label="이미지 크기 조절">
        <button type="button" data-image-action="out" aria-label="이미지 축소" title="축소">−</button>
        <output class="image-viewer-scale" aria-live="polite" aria-atomic="true">100%</output>
        <button type="button" data-image-action="in" aria-label="이미지 확대" title="확대">+</button>
        <button type="button" data-image-action="fit">화면 맞춤</button>
        <button type="button" data-image-action="actual">100%</button>
        <span class="image-viewer-help">확대하면 스크롤하여 이동할 수 있습니다.</span>
      </div>
      <div class="image-viewer-viewport" tabindex="0" aria-label="확대 이미지, 스크롤하여 이동">
        <div class="image-viewer-canvas"><img class="image-viewer-image" alt="" hidden></div>
        <p class="image-viewer-notice" role="status">이미지를 불러오는 중입니다.</p>
      </div>
    </div>`;
  document.body.append(dialog);

  const title = dialog.querySelector('h2');
  const closeButton = dialog.querySelector('.image-viewer-close');
  const viewport = dialog.querySelector('.image-viewer-viewport');
  const canvas = dialog.querySelector('.image-viewer-canvas');
  const picture = dialog.querySelector('.image-viewer-image');
  const notice = dialog.querySelector('.image-viewer-notice');
  const scaleLabel = dialog.querySelector('.image-viewer-scale');
  const zoomOut = dialog.querySelector('[data-image-action="out"]');
  const zoomIn = dialog.querySelector('[data-image-action="in"]');
  let returnFocus = null;
  let scale = 1;
  let fitMode = true;

  function setScale(value, preservePosition = true) {
    if (!picture.naturalWidth || !picture.naturalHeight) return;
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / Math.max(1, viewport.scrollWidth);
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(1, viewport.scrollHeight);
    scale = Math.max(0.01, Math.min(8, value));
    picture.style.width = `${picture.naturalWidth * scale}px`;
    picture.style.height = `${picture.naturalHeight * scale}px`;
    scaleLabel.value = `${Math.round(scale * 100)}%`;
    zoomOut.disabled = scale <= 0.01;
    zoomIn.disabled = scale >= 8;
    if (preservePosition) {
      viewport.scrollLeft = centerX * viewport.scrollWidth - viewport.clientWidth / 2;
      viewport.scrollTop = centerY * viewport.scrollHeight - viewport.clientHeight / 2;
    } else {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  }

  function fitToScreen() {
    if (!dialog.open || !picture.naturalWidth) return;
    const padding = getComputedStyle(canvas);
    const width = viewport.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
    const height = viewport.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
    fitMode = true;
    setScale(Math.min(1, width / picture.naturalWidth, height / picture.naturalHeight), false);
  }

  function showLoadedPicture() {
    if (!dialog.open || !picture.naturalWidth) return;
    picture.hidden = false;
    notice.hidden = true;
    fitToScreen();
  }

  function openPicture(source, trigger) {
    returnFocus = trigger;
    const caption = source.closest('figure').querySelector('figcaption');
    title.textContent = caption?.textContent.trim() || source.alt || '이미지 크게 보기';
    picture.alt = source.alt || title.textContent;
    picture.hidden = true;
    notice.textContent = '이미지를 불러오는 중입니다.';
    notice.hidden = false;
    fitMode = true;
    dialog.showModal();
    document.documentElement.classList.add('image-viewer-open');
    picture.src = source.dataset.fullSrc || source.currentSrc || source.src;
    if (picture.complete && picture.naturalWidth) showLoadedPicture();
    closeButton.focus({ preventScroll: true });
  }

  picture.draggable = false;
  picture.addEventListener('load', showLoadedPicture);
  picture.addEventListener('error', () => {
    picture.hidden = true;
    notice.hidden = false;
    notice.textContent = '이미지를 불러오지 못했습니다.';
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('image-viewer-open');
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  });
  dialog.querySelector('.image-viewer-toolbar').addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.imageAction;
    if (!action) return;
    if (action === 'fit') { fitToScreen(); return; }
    fitMode = false;
    if (action === 'actual') setScale(1);
    if (action === 'in') setScale(scale * 1.25);
    if (action === 'out') setScale(scale / 1.25);
  });
  window.addEventListener('resize', () => {
    if (dialog.open && fitMode) fitToScreen();
  });
  pictures.forEach(source => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.classList.add('image-zoom-trigger');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.setAttribute('aria-label', `${source.alt || '이미지'} 크게 보기`);
    trigger.title = '클릭하여 크게 보기';
    source.before(trigger);
    trigger.append(source);
    trigger.addEventListener('click', () => openPicture(source, trigger));
  });
})();
