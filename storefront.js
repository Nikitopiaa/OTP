(() => {
  const scrollArea = document.querySelector('#scrollArea');
  const screen = scrollArea.parentElement;
  const gift = document.querySelector('#gift');
  const giftToggle = document.querySelector('#giftToggleButton');
  const controls = document.querySelector('.prototype-controls');
  const backdrop = document.querySelector('#sheetBackdrop');
  const sheet = backdrop.querySelector('.bottom-sheet');
  const closeButton = sheet.querySelector('.sheet-close');
  const modalBackground = [scrollArea, gift, screen.querySelector('.bottom-bar'), controls, document.querySelector('.sf-back')];
  let previousFocus;
  const hero = document.querySelector('.sf-hero');
  const offers = [...document.querySelectorAll('.sf-offer')];
  const indicator = document.querySelector('.sf-dots');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const slots = [{ x: 0, w: 4 }, { x: 8, w: 6 }, { x: 18, w: 22 }, { x: 44, w: 6 }, { x: 54, w: 4 }];
  let activeOffer = 0;
  let progress;
  let heroVisible = true;
  let pulling = false;
  let gesture;
  let pullFrame;
  let returnTimer;
  let suppressClickUntil = 0;

  function syncPlayback() {
    if (!progress) return;
    const playing = !document.hidden && heroVisible && !pulling && backdrop.hidden;
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
    dot.addEventListener('click', () => selectOffer(Number(dot.dataset.offer)));
    return dot;
  }

  let dots = slots.map(() => makeDot());
  indicator.append(...dots);

  function positionDots() {
    dots.forEach((dot, index) => {
      const offer = (activeOffer + index - 2 + offers.length) % offers.length;
      dot.style.left = slots[index].x + 'px';
      dot.style.width = slots[index].w + 'px';
      dot.style.transform = index === 0 || index === 4 ? 'scaleY(.667)' : 'none';
      dot.style.opacity = '1';
      dot.dataset.offer = offer;
      dot.setAttribute('aria-label', offers[offer].getAttribute('aria-label'));
      dot.setAttribute('aria-current', String(index === 2));
    });
  }

  function startProgress() {
    progress?.cancel();
    progress = dots[2].firstElementChild.animate(
      [{ width: '6px' }, { width: '22px' }],
      { duration: 10000, fill: 'forwards', easing: 'linear' }
    );
    progress.onfinish = () => selectOffer((activeOffer + 1) % offers.length);
    syncPlayback();
  }

  function selectOffer(index) {
    if (index === activeOffer) return;
    activeOffer = index;
    offers.forEach((offer, i) => {
      offer.classList.toggle('active', i === index);
      offer.inert = i !== index;
      offer.setAttribute('aria-hidden', String(i !== index));
    });
    const departing = dots.shift();
    departing.style.transform = 'scale(0)';
    departing.style.opacity = '0';
    departing.inert = true;
    setTimeout(() => departing.remove(), reducedMotion.matches ? 0 : 420);
    const arriving = makeDot();
    arriving.style.left = '54px';
    arriving.style.width = '4px';
    arriving.style.transform = 'scale(0)';
    arriving.style.opacity = '0';
    indicator.append(arriving);
    dots.push(arriving);
    // Commit the starting size so the new end dot grows in place.
    arriving.getBoundingClientRect();
    positionDots();
    startProgress();
  }

  positionDots();
  startProgress();
  new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
    syncPlayback();
  }, { root: scrollArea }).observe(hero);
  document.addEventListener('visibilitychange', syncPlayback);

  function beginPull(x, y, id, kind, target) {
    if (pulling || !backdrop.hidden || scrollArea.scrollTop > 0 ||
        target.closest('input,textarea,select') || (kind === 'mouse' && target.closest('button,a'))) return;
    gesture = { x, y, id, kind, base: hero.getBoundingClientRect().height, distance: 0 };
  }

  function movePull(x, y, event) {
    if (!gesture) return;
    const dy = y - gesture.y;
    const dx = x - gesture.x;
    if (!pulling) {
      if (scrollArea.scrollTop > 0 || Math.abs(dx) > Math.max(6, Math.abs(dy))) {
        gesture = null;
        return;
      }
      if (dy <= 0) return;
      if (!event.cancelable) { gesture = null; return; }
      pulling = true;
      scrollArea.classList.add('is-pulling');
      syncPlayback();
      if (gesture.kind === 'mouse') scrollArea.setPointerCapture(gesture.id);
    }
    if (event.cancelable) event.preventDefault();
    const limit = Math.min(360, gesture.base * .8);
    gesture.distance = limit * (1 - Math.exp(-Math.max(0, dy) * .65 / limit));
    if (pullFrame) return;
    pullFrame = requestAnimationFrame(() => {
      pullFrame = null;
      if (!gesture) return;
      hero.style.height = (gesture.base + gesture.distance) + 'px';
      hero.style.setProperty('--sf-art-scale', 1 + gesture.distance / gesture.base);
    });
  }

  function finishPull() {
    const input = gesture;
    gesture = null;
    cancelAnimationFrame(pullFrame);
    pullFrame = null;
    if (!pulling || !input) return;
    suppressClickUntil = performance.now() + 450;
    scrollArea.classList.remove('is-pulling');
    hero.classList.add('is-pull-returning');
    hero.style.height = input.base + 'px';
    hero.style.removeProperty('--sf-art-scale');
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => {
      hero.classList.remove('is-pull-returning');
      hero.style.removeProperty('height');
      pulling = false;
      syncPlayback();
    }, reducedMotion.matches ? 0 : 440);
  }

  scrollArea.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { finishPull(); return; }
    const touch = event.touches[0];
    beginPull(touch.clientX, touch.clientY, touch.identifier, 'touch', event.target);
  }, { passive: true });
  scrollArea.addEventListener('touchmove', event => {
    if (gesture?.kind !== 'touch') return;
    if (event.touches.length !== 1) { finishPull(); return; }
    const touch = event.touches[0];
    if (touch.identifier === gesture.id) movePull(touch.clientX, touch.clientY, event);
  }, { passive: false });
  for (const name of ['touchend', 'touchcancel']) {
    scrollArea.addEventListener(name, () => { if (gesture?.kind === 'touch') finishPull(); }, { passive: true });
  }
  scrollArea.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button === 0) beginPull(event.clientX, event.clientY, event.pointerId, 'mouse', event.target);
  });
  scrollArea.addEventListener('pointermove', event => {
    if (gesture?.kind === 'mouse' && gesture.id === event.pointerId) movePull(event.clientX, event.clientY, event);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    scrollArea.addEventListener(name, () => { if (gesture?.kind === 'mouse') finishPull(); });
  }
  scrollArea.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  addEventListener('resize', finishPull);

  function setGiftVisible(visible) {
    gift.hidden = !visible;
    giftToggle.textContent = visible ? 'Скрыть подарок' : 'Показать подарок';
    giftToggle.setAttribute('aria-pressed', String(visible));
  }

  function openSheet(trigger) {
    previousFocus = trigger;
    sheet.querySelector('#sheetTitle').textContent = trigger.dataset.detail;
    const copy = sheet.querySelector('#sheetCopy');
    copy.textContent = trigger.dataset.copy || '';
    copy.hidden = !copy.textContent;
    backdrop.hidden = false;
    for (const element of modalBackground) element.inert = true;
    closeButton.focus();
    syncPlayback();
  }

  function closeSheet() {
    backdrop.hidden = true;
    for (const element of modalBackground) element.inert = false;
    previousFocus?.focus({ preventScroll: true });
    syncPlayback();
  }

  screen.addEventListener('click', event => {
    const detail = event.target.closest('[data-detail]');
    if (detail) openSheet(detail);
    if (event.target.closest('.gift-close')) setGiftVisible(false);
    if (event.target.closest('[data-scroll-top]')) {
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      scrollArea.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
    }
  });
  giftToggle.addEventListener('click', () => setGiftVisible(gift.hidden));
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop || event.target.closest('.sheet-close, [data-close-sheet]')) closeSheet();
  });
  backdrop.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSheet();
  });

  function syncTopMaterial() {
    screen.classList.toggle('sf-scrolled', scrollArea.scrollTop > 28);
  }
  scrollArea.addEventListener('scroll', syncTopMaterial, { passive: true });
  syncTopMaterial();
})();
