// dynamic-sidebar-blur.js
// Apply a dynamic blur layer behind the NexT sidebar based on scroll position.

(function() {
  const BLUR_VALUE_PX = 16;
  let listenersAttached = false;

  function ensureBlurLayer(sidebar) {
    let blurLayer = document.querySelector('.sidebar-background-blur-effect');
    if (!blurLayer) {
      blurLayer = document.createElement('div');
      blurLayer.className = 'sidebar-background-blur-effect';
      // Insert as first child for stacking below content but inside sidebar container parent if possible.
      if (sidebar.parentElement) {
        sidebar.parentElement.insertBefore(blurLayer, sidebar);
      } else {
        document.body.appendChild(blurLayer);
      }
    }
    return blurLayer;
  }

  function applyBlur(sidebar, blurLayer) {
    const rect = sidebar.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      blurLayer.style.backdropFilter = 'blur(0px)';
      blurLayer.style.webkitBackdropFilter = 'blur(0px)';
      return;
    }
    blurLayer.style.backdropFilter = `blur(${BLUR_VALUE_PX}px)`;
    blurLayer.style.webkitBackdropFilter = `blur(${BLUR_VALUE_PX}px)`;
  }

  function attach() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const blurLayer = ensureBlurLayer(sidebar);
    applyBlur(sidebar, blurLayer);

    if (!listenersAttached) {
      const handler = () => applyBlur(sidebar, blurLayer);
      window.addEventListener('scroll', handler, { passive: true });
      window.addEventListener('resize', handler);
      listenersAttached = true;
    }
  }

  document.addEventListener('DOMContentLoaded', attach);
  window.addEventListener('pjax:success', attach);
})();
