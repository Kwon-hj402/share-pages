/* Keep the staged image in the existing slide and reset only this feature. */
(() => {
  const isPreview = () => new URLSearchParams(location.search).has('preview') || document.documentElement.hasAttribute('data-preview');
  const slides = () => [...document.querySelectorAll('#deck>.segmentation-focus-v20')];
  let channel;
  try { channel = new BroadcastChannel('chen-review-stage-' + location.pathname); } catch (_) {}
  const publish = slide => {
    if (channel && !isPreview()) channel.postMessage({type:'stages',states:[{id:slide.dataset.slideId,stage:slide.dataset.stage || '0'}]});
  };
  const reset = slide => {
    if (slide.dataset.stage !== '0') { slide.dataset.stage = '0'; publish(slide); }
  };
  function initialize() {
    if (isPreview()) return;
    const deck = document.querySelector('#deck');
    const sync = () => slides().forEach(slide => {
      if (!slide.classList.contains('is-active') || document.body.classList.contains('edit-mode')) reset(slide);
    });
    sync();
    new MutationObserver(sync).observe(deck,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || isPreview() || document.body.classList.contains('edit-mode') || document.querySelector('.image-modal.open')) return;
    const slide = document.querySelector('#deck>.segmentation-focus-v20.is-active[data-stage="1"]');
    if (!slide) return;
    slide.dataset.stage = '2'; publish(slide);
    event.preventDefault(); event.stopImmediatePropagation();
  },true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initialize); else initialize();
})();
