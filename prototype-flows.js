function mountPrototypeFlows(onCoveredChange) {
  const scrollArea = document.querySelector('#scrollArea');
  const screen = scrollArea.parentElement;
  const controls = document.querySelector('.prototype-controls');
  const back = document.querySelector('.sf-back');
  const gift = screen.querySelector('#gift');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = screen.closest('.stage');
  const nav = screen.querySelector('.bottom-bar');
  const layer = screen.querySelector('.sf-product-layer');
  const currencyLayer = screen.querySelector('.sf-currency-layer');
  const currency = screen.querySelector('#sf-currency');
  const hearts = screen.querySelector('.sf-hearts');
  const toast = screen.querySelector('.sf-toast');
  const pixel = value => value + 'px';

  let productTrigger;
  let currencyTrigger;
  let toastTimer;
  let productObserver;

  function syncInert() {
    const modalOpen = !currencyLayer.hidden;
    const covered = !layer.hidden || modalOpen;
    for (const element of [scrollArea, gift, nav]) element.inert = covered;
    layer.inert = modalOpen;
    controls.inert = modalOpen;
    back.inert = covered;
    onCoveredChange(covered);
  }

  function closeCurrency(restoreFocus = true) {
    currencyLayer.hidden = true;
    syncInert();
    if (restoreFocus) currencyTrigger?.focus({ preventScroll: true });
  }

  function openCurrency(trigger) {
    currencyTrigger = trigger;
    controls.open = false;
    currencyLayer.hidden = false;
    syncInert();
    currency.focus({ preventScroll: true });
  }

  function syncProductChrome(view) {
    const scroller = view.querySelector('.sf-product-scroll');
    const footer = view.querySelector('.sf-product-footer');
    const header = view.querySelector('.sf-product-header');
    const panel = view.querySelector('[data-header-panel]');
    const material = view.querySelector('.sf-product-material');
    const updateMaterial = () => {
      const overlap = header.getBoundingClientRect().bottom - panel.getBoundingClientRect().top;
      const opacity = scroller.scrollTop > 0 ? Math.max(0, Math.min(1, overlap / 40)) : 0;
      material.style.setProperty('--chrome-opacity', opacity);
    };
    productObserver = new ResizeObserver(() => {
      if (footer) view.style.setProperty('--sf-footer-height', pixel(footer.offsetHeight));
      if (material) updateMaterial();
    });
    if (footer) {
      view.style.setProperty('--sf-footer-height', pixel(footer.offsetHeight));
      productObserver.observe(footer);
    }
    if (material) {
      scroller.addEventListener('scroll', updateMaterial, { passive: true });
      productObserver.observe(header);
      productObserver.observe(panel);
      updateMaterial();
    }
  }

  function renderRoute() {
    if (!currencyLayer.hidden) closeCurrency(false);
    productObserver?.disconnect();
    const route = location.hash.slice(1);
    const template = route && document.getElementById('sf-product-' + route);
    layer.replaceChildren();
    layer.hidden = !template;
    if (template) {
      layer.append(template.content.cloneNode(true));
      syncProductChrome(layer.firstElementChild);
    }
    syncInert();
    if (template) layer.querySelector('[data-product-back]').focus({ preventScroll: true });
    else {
      productTrigger?.focus({ preventScroll: true });
      productTrigger = null;
    }
  }

  function goToProduct(route, trigger) {
    if (route === 'currency') {
      openCurrency(trigger);
      return;
    }
    if (!document.getElementById('sf-product-' + route) || location.hash === '#' + route) return;
    if (layer.hidden) productTrigger = trigger;
    controls.open = false;
    const depth = (history.state?.sfDepth || 0) + 1;
    history.pushState({ sfDepth: depth }, '', '#' + route);
    renderRoute();
  }

  function backToProductList() {
    if (history.state?.sfDepth) history.back();
    else {
      history.replaceState(null, '', location.pathname + location.search);
      renderRoute();
    }
  }

  function dismissNotice() {
    if (!toast.classList.contains('visible')) return;
    clearTimeout(toastTimer);
    hearts.replaceChildren();
    toast.classList.remove('visible');
    toast.textContent = '';
  }

  function showUnavailable() {
    dismissNotice();
    toast.textContent = 'Там ничего нет, но возможно когда-нибудь появится. Сейчас доступен только флоу витрины.';
    toast.classList.add('visible');
    if (!reducedMotion.matches) {
      for (let index = 0; index < 22; index++) {
        const heart = new Image();
        heart.src = hearts.dataset.image;
        heart.alt = '';
        heart.style.setProperty('--x', (2 + Math.random() * 94) + '%');
        heart.style.setProperty('--size', pixel(18 + Math.random() * 50));
        heart.style.setProperty('--duration', (1.5 + Math.random() * 1.1) + 's');
        heart.style.setProperty('--delay', (Math.random() * .75) + 's');
        heart.style.setProperty('--tilt', (-40 + Math.random() * 80) + 'deg');
        heart.style.setProperty('--drift', pixel(-54 + Math.random() * 108));
        heart.style.setProperty('--fall', pixel(screen.clientHeight + 185));
        hearts.append(heart);
      }
    }
    toastTimer = setTimeout(dismissNotice, 3900);
  }

  for (const event of ['pointerdown', 'click', 'keydown', 'wheel', 'scroll']) {
    stage.addEventListener(event, dismissNotice, { capture: true, passive: true });
  }

  screen.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.product) goToProduct(target.dataset.product, target);
    else if (target.hasAttribute('data-product-back')) backToProductList();
    else if (target.matches('.sf-sheet-handle, .sf-currency-veil')) closeCurrency();
    else if (target.dataset.currency) {
      closeCurrency();
      showUnavailable();
    } else if (target.hasAttribute('data-unavailable')) showUnavailable();
    else if (target.hasAttribute('data-scroll-top')) scrollArea.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    else if (target.hasAttribute('data-pill')) {
      for (const sibling of target.parentElement.children) sibling.setAttribute('aria-pressed', String(sibling === target));
    } else if (target.hasAttribute('data-map-zoom')) {
      const map = target.closest('.sf-fuel-map');
      const increment = Number(target.dataset.mapZoom);
      const scale = increment ? Math.max(1, Math.min(2.5, Number(map.dataset.scale || 1) + increment * .2)) : 1;
      map.dataset.scale = scale;
      map.style.setProperty('--sf-map-scale', scale);
    }
  });

  layer.addEventListener('input', event => {
    if (event.target.id !== 'sf-credit-limit') return;
    layer.querySelector('output').value = Number(event.target.value).toLocaleString('ru-RU') + ' ₽';
  });

  document.addEventListener('keydown', event => {
    if (!currencyLayer.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); closeCurrency(); }
      if (event.key === 'Tab') {
        const focusable = [...currency.querySelectorAll('button')];
        const index = focusable.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1).focus({ preventScroll: true }); }
        if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus({ preventScroll: true }); }
      }
      return;
    }
    if (event.key === 'Escape' && controls.open) { event.preventDefault(); controls.open = false; controls.querySelector('summary').focus(); return; }
    if (event.key === 'Escape' && !layer.hidden) { event.preventDefault(); backToProductList(); }
  });

  document.addEventListener('click', event => {
    if (controls.open && !controls.contains(event.target)) controls.open = false;
  });
  window.addEventListener('popstate', renderRoute);
  renderRoute();
}
