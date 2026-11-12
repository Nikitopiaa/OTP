(() => {
  const scrollArea = document.querySelector('#scrollArea');
  const screen = scrollArea.parentElement;
  const stage = screen.closest('.stage');
  const hero = screen.querySelector('.sf-hero');
  const offers = [...hero.querySelectorAll('.sf-offer')];
  const indicator = hero.querySelector('.sf-dots');
  const gift = screen.querySelector('#gift');
  const giftToggle = document.querySelector('#giftToggleButton');
  const controls = document.querySelector('.prototype-controls');
  const nav = screen.querySelector('.bottom-bar');
  const layer = screen.querySelector('.sf-product-layer');
  const currency = screen.querySelector('#sf-currency');
  const hearts = screen.querySelector('.sf-hearts');
  const toast = screen.querySelector('.sf-toast');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const slots = [{ x: 0, w: 4 }, { x: 8, w: 6 }, { x: 18, w: 22 }, { x: 44, w: 6 }, { x: 54, w: 4 }];
  const wrap = index => (index + offers.length) % offers.length;
  const pixel = value => value + 'px';
  const currencyVeil = document.createElement('button');
  currencyVeil.className = 'sf-currency-veil';
  currencyVeil.type = 'button';
  currencyVeil.tabIndex = -1;
  currencyVeil.hidden = true;
  currencyVeil.setAttribute('aria-label', 'Закрыть выбор валюты');
  currency.before(currencyVeil);
  currency.setAttribute('aria-modal', 'true');

  let active = 0;
  let progress;
  let heroVisible = true;
  let gesture;
  let transition;
  let pullFrame;
  let pullReturn;
  let suppressClickUntil = 0;
  let productTrigger;
  let currencyTrigger;
  let toastTimer;
  let footerObserver;

  function syncPlayback() {
    if (!progress) return;
    const playing = !document.hidden && heroVisible && !gesture && !transition && !pullReturn && !currency.open && layer.hidden;
    if (playing && progress.playState === 'paused') progress.play();
    if (!playing && progress.playState === 'running') progress.pause();
  }

  function makeDot() {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'sf-dot';
    const fill = document.createElement('span');
    fill.className = 'sf-dot-fill';
    dot.append(fill);
    dot.addEventListener('click', () => {
      const step = Number(dot.dataset.step);
      if (step) slide(step, true);
    });
    return dot;
  }

  const dots = slots.map(makeDot);
  indicator.append(...dots);
  function positionDots() {
    dots.forEach((dot, index) => {
      const step = index - 2;
      dot.style.left = pixel(slots[index].x);
      dot.style.width = pixel(slots[index].w);
      dot.style.transform = index === 0 || index === 4 ? 'scaleY(.667)' : 'none';
      dot.style.opacity = '1';
      dot.dataset.step = step;
      dot.setAttribute('aria-label', offers[wrap(active + step)].getAttribute('aria-label'));
      dot.setAttribute('aria-current', String(step === 0));
    });
  }

  function rotateDots(direction) {
    const departing = direction > 0 ? dots.shift() : dots.pop();
    departing.style.transform = 'scale(0)';
    departing.style.opacity = '0';
    departing.inert = true;
    const arriving = makeDot();
    arriving.style.left = direction > 0 ? '54px' : '0px';
    arriving.style.width = '4px';
    arriving.style.transform = 'scale(0)';
    arriving.style.opacity = '0';
    indicator.append(arriving);
    if (direction > 0) dots.push(arriving);
    else dots.unshift(arriving);
    arriving.getBoundingClientRect();
    positionDots();
    setTimeout(() => departing.remove(), reducedMotion.matches ? 0 : 420);
  }

  function startProgress() {
    progress?.cancel();
    progress = dots[2].firstElementChild.animate(
      [{ width: '6px' }, { width: '22px' }],
      { duration: 10000, fill: 'forwards', easing: 'linear' }
    );
    progress.onfinish = () => slide(1);
    syncPlayback();
  }

  function slide(step, user = false, offset = 0, commit = true) {
    if (transition || pullReturn || !layer.hidden || currency.open || !step) return;
    const direction = Math.sign(step);
    const index = wrap(active + step);
    const current = offers[active];
    const next = offers[index];
    const width = hero.clientWidth;
    const displaced = direction * width;
    next.classList.add('in-motion');
    if (commit) {
      current.inert = true;
      current.setAttribute('aria-hidden', 'true');
      active = index;
      progress?.cancel();
      rotateDots(direction);
      if (user && typeof navigator.vibrate === 'function') navigator.vibrate(8);
    }
    const duration = reducedMotion.matches ? 0 : 330;
    const animate = (element, from, to) => element.animate(
      [{ transform: 'translateX(' + pixel(from) + ')' }, { transform: 'translateX(' + pixel(to) + ')' }],
      { duration, easing: 'cubic-bezier(.22,.72,.24,1)', fill: 'forwards' }
    );
    const motions = [
      animate(current, offset, commit ? -displaced : 0),
      animate(next, displaced + offset, commit ? 0 : displaced)
    ];
    transition = motions;
    syncPlayback();
    Promise.all(motions.map(animation => animation.finished)).then(() => {
      for (const offer of [current, next]) {
        const selected = offer === offers[active];
        offer.classList.toggle('active', selected);
        offer.classList.remove('in-motion');
        offer.style.removeProperty('transform');
        offer.inert = !selected;
        offer.setAttribute('aria-hidden', String(!selected));
      }
      motions.forEach(animation => animation.cancel());
      transition = null;
      if (commit) startProgress();
      else syncPlayback();
    });
  }

  positionDots();
  startProgress();
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    syncPlayback();
  }, { root: scrollArea }).observe(hero);
  document.addEventListener('visibilitychange', syncPlayback);

  function beginGesture(x, y, id, kind, target) {
    if (gesture || transition || pullReturn || !layer.hidden || currency.open || !hero.contains(target) ||
        target.closest('.sf-dots, input, select')) return;
    gesture = { x, y, id, kind, base: hero.offsetHeight, offset: 0, direction: 0, atTop: scrollArea.scrollTop <= 0 };
    syncPlayback();
  }

  function positionDrag(offset) {
    const direction = offset < 0 ? 1 : -1;
    const current = offers[active];
    if (gesture.direction && gesture.direction !== direction) {
      const previous = offers[wrap(active + gesture.direction)];
      previous.classList.remove('in-motion');
      previous.style.removeProperty('transform');
    }
    const next = offers[wrap(active + direction)];
    gesture.direction = direction;
    gesture.offset = Math.max(-hero.clientWidth, Math.min(hero.clientWidth, offset));
    current.style.transform = 'translateX(' + pixel(gesture.offset) + ')';
    next.style.transform = 'translateX(' + pixel(direction * hero.clientWidth + gesture.offset) + ')';
    next.classList.add('in-motion');
  }

  function moveGesture(x, y, event) {
    if (!gesture) return;
    const dx = x - gesture.x;
    const dy = y - gesture.y;
    if (!gesture.mode) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.15) gesture.mode = 'slide';
      else if (gesture.atTop && dy > 0 && scrollArea.scrollTop <= 0) gesture.mode = 'pull';
      else { finishGesture(); return; }
      if (!event.cancelable) { gesture.mode = null; finishGesture(); return; }
      if (gesture.mode === 'pull') gesture.artHeight = offers[active].querySelector('.sf-hero-art span').offsetHeight;
      scrollArea.classList.add('is-pulling');
      if (gesture.kind === 'mouse') scrollArea.setPointerCapture(gesture.id);
      syncPlayback();
    }
    if (event.cancelable) event.preventDefault();
    if (gesture.mode === 'slide') {
      positionDrag(dx);
      return;
    }
    const limit = Math.min(310, gesture.base * .75);
    gesture.offset = limit * (1 - Math.exp(-Math.max(0, dy) * .76 / limit));
    if (!pullFrame) pullFrame = requestAnimationFrame(() => {
      pullFrame = null;
      if (gesture?.mode !== 'pull') return;
      const distance = gesture.offset;
      const scale = 1 + .9 * (1 - Math.exp(-distance / 160));
      const artGrowth = (scale - 1) * gesture.artHeight;
      hero.style.height = pixel(gesture.base + distance);
      hero.style.setProperty('--sf-art-scale', scale);
      hero.style.setProperty('--sf-art-shift', pixel((artGrowth - distance) * .42));
    });
  }

  function finishGesture(cancelled = false) {
    const input = gesture;
    gesture = null;
    if (!input?.mode) { syncPlayback(); return; }
    scrollArea.classList.remove('is-pulling');
    suppressClickUntil = performance.now() + 350;
    if (input.mode === 'slide') {
      slide(input.direction, true, input.offset, !cancelled && Math.abs(input.offset) >= Math.min(65, hero.clientWidth * .16));
      return;
    }
    cancelAnimationFrame(pullFrame);
    pullFrame = null;
    hero.classList.add('is-pull-returning');
    hero.style.height = pixel(input.base);
    hero.style.removeProperty('--sf-art-scale');
    hero.style.removeProperty('--sf-art-shift');
    pullReturn = setTimeout(() => {
      hero.classList.remove('is-pull-returning');
      hero.style.removeProperty('height');
      pullReturn = null;
      syncPlayback();
    }, reducedMotion.matches ? 0 : 440);
  }

  scrollArea.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { finishGesture(true); return; }
    const touch = event.touches[0];
    beginGesture(touch.clientX, touch.clientY, touch.identifier, 'touch', event.target);
  }, { passive: true });
  scrollArea.addEventListener('touchmove', event => {
    const touch = event.touches[0];
    if (event.touches.length !== 1) { finishGesture(true); return; }
    if (gesture?.kind === 'touch' && touch.identifier === gesture.id) moveGesture(touch.clientX, touch.clientY, event);
  }, { passive: false });
  scrollArea.addEventListener('touchend', () => { if (gesture?.kind === 'touch') finishGesture(); });
  scrollArea.addEventListener('touchcancel', () => { if (gesture?.kind === 'touch') finishGesture(true); });
  scrollArea.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button === 0) beginGesture(event.clientX, event.clientY, event.pointerId, 'mouse', event.target);
  });
  scrollArea.addEventListener('pointermove', event => {
    if (gesture?.kind === 'mouse' && event.pointerId === gesture.id) moveGesture(event.clientX, event.clientY, event);
  });
  window.addEventListener('pointerup', () => { if (gesture?.kind === 'mouse') finishGesture(); });
  scrollArea.addEventListener('pointercancel', () => { if (gesture?.kind === 'mouse') finishGesture(true); });
  scrollArea.addEventListener('lostpointercapture', () => { if (gesture?.kind === 'mouse') finishGesture(true); });
  scrollArea.addEventListener('click', event => {
    if (hero.contains(event.target) && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('resize', () => finishGesture(true));

  function setGiftVisible(visible) {
    gift.hidden = !visible;
    giftToggle.textContent = visible ? 'Скрыть подарок' : 'Показать подарок';
    giftToggle.setAttribute('aria-pressed', String(visible));
  }

  function syncInert() {
    const covered = !layer.hidden || currency.open;
    for (const element of [scrollArea, gift, nav]) element.inert = covered;
    layer.inert = currency.open;
    controls.inert = currency.open;
    document.querySelector('.sf-back').inert = covered;
    syncPlayback();
  }

  function closeCurrency(restoreFocus = true) {
    currency.close();
    currencyVeil.hidden = true;
    syncInert();
    if (restoreFocus) currencyTrigger?.focus({ preventScroll: true });
  }

  function openCurrency(trigger) {
    currencyTrigger = trigger;
    controls.open = false;
    currencyVeil.hidden = false;
    currency.show();
    syncInert();
    currency.querySelector('[data-currency]').focus({ preventScroll: true });
  }

  function renderRoute() {
    if (currency.open) closeCurrency(false);
    footerObserver?.disconnect();
    const route = location.hash.slice(1);
    const template = route && document.getElementById('sf-product-' + route);
    layer.replaceChildren();
    layer.hidden = !template;
    if (template) {
      layer.append(template.content.cloneNode(true));
      const footer = layer.querySelector('.sf-product-footer');
      if (footer) {
        const view = layer.firstElementChild;
        const measure = () => view.style.setProperty('--sf-footer-height', pixel(footer.offsetHeight));
        footerObserver = new ResizeObserver(measure);
        footerObserver.observe(footer);
        measure();
      }
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
    if (location.hash === '#' + route || !document.getElementById('sf-product-' + route)) return;
    if (layer.hidden) productTrigger = trigger;
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
    else if (target.hasAttribute('data-pill')) {
      for (const sibling of target.parentElement.children) sibling.setAttribute('aria-pressed', String(sibling === target));
    } else if (target.hasAttribute('data-map-zoom')) {
      const map = target.closest('.sf-fuel-map');
      const increment = Number(target.dataset.mapZoom);
      const scale = increment ? Math.max(1, Math.min(2.5, Number(map.dataset.scale || 1) + increment * .2)) : 1;
      map.dataset.scale = scale;
      map.style.setProperty('--sf-map-scale', scale);
    } else if (target.matches('.gift-close')) setGiftVisible(false);
    else if (target.hasAttribute('data-scroll-top')) scrollArea.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });

  layer.addEventListener('input', event => {
    if (event.target.id !== 'sf-credit-limit') return;
    layer.querySelector('output').value = Number(event.target.value).toLocaleString('ru-RU') + ' ₽';
  });

  document.addEventListener('keydown', event => {
    if (currency.open) {
      if (event.key === 'Escape') { event.preventDefault(); closeCurrency(); }
      if (event.key === 'Tab') {
        const focusable = [...currency.querySelectorAll('button')];
        const index = focusable.indexOf(document.activeElement);
        if (event.shiftKey && index === 0) { event.preventDefault(); focusable.at(-1).focus(); }
        if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
      }
      return;
    }
    if (event.key === 'Escape' && controls.open) { controls.open = false; controls.querySelector('summary').focus(); return; }
    if (event.key === 'Escape' && !layer.hidden) { backToProductList(); return; }
    if (!layer.hidden || controls.open || !heroVisible || event.target.closest('input,select,textarea')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      slide(event.key === 'ArrowRight' ? 1 : -1, true);
    }
  });

  document.addEventListener('click', event => {
    if (controls.open && !controls.contains(event.target)) controls.open = false;
  });
  giftToggle.addEventListener('click', () => setGiftVisible(gift.hidden));
  for (const toggle of controls.querySelectorAll('[data-badge-toggle]')) {
    const badge = screen.querySelector('.sf-badge--' + toggle.dataset.badgeToggle);
    const key = 'otp-storefront-badge-' + toggle.dataset.badgeToggle;
    try { toggle.checked = localStorage.getItem(key) !== 'hidden'; } catch {}
    badge.hidden = !toggle.checked;
    toggle.addEventListener('change', () => {
      badge.hidden = !toggle.checked;
      try { localStorage.setItem(key, toggle.checked ? 'visible' : 'hidden'); } catch {}
    });
  }
  window.addEventListener('popstate', renderRoute);
  scrollArea.addEventListener('scroll', () => {
    screen.classList.toggle('sf-scrolled', scrollArea.scrollTop > 28);
  }, { passive: true });
  renderRoute();
})();
