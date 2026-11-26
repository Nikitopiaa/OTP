(() => {
  mountPrototypeFlows();

  const screen = document.querySelector('.screen');
  const controls = document.querySelector('.prototype-controls');
  const privacy = document.querySelector('#home-privacy');
  const hiddenList = document.querySelector('#home-hidden-offers');
  const hiddenSummary = document.querySelector('.home-hidden summary');
  const hiddenEmpty = document.querySelector('.home-hidden-empty');
  const slider = document.querySelector('.home-banners');
  const markerList = slider.querySelector('.home-banner-dots');
  const slots = new Map([...screen.querySelectorAll('[data-home-slot]')].map(slot => [slot.dataset.homeSlot, slot]));
  const layoutSave = document.querySelector('#home-layout-save');
  const layoutStatus = document.querySelector('#home-layout-status');
  const storageKey = 'otp-home-offers-v1';

  const config = JSON.parse(document.querySelector('#home-offer-data').textContent);
  const settings = new Map([...controls.querySelectorAll('[data-home-setting]')].map(card => [card.dataset.homeSetting, card]));
  const placementDraft = new Map();
  const offerTemplate = document.querySelector('#home-offer-variants').content;
  const editedImage = /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/=]+$/;
  const savedText = (value, fallback, limit) => typeof value === 'string' ? value.slice(0, limit) : fallback;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch {}

  const entries = new Map(Object.entries(config.offers).map(([id, offer]) => {
    const initial = {
      section: offer.section,
      enabled: true,
      title: offer.title.replaceAll('<br>', '\n'),
      copy: (offer.copy || '').replaceAll('<br>', '\n'),
      showCopy: Boolean(offer.copy),
      label: offer.label || 'Подробнее',
      art: offer.art
    };
    const overrides = saved[id] || {};
    const copy = savedText(overrides.copy, initial.copy, 300);
    const state = {
      section: slots.has(overrides.section) ? overrides.section : initial.section,
      enabled: typeof overrides.enabled === 'boolean' ? overrides.enabled : initial.enabled,
      title: savedText(overrides.title, initial.title, 140) || initial.title,
      copy,
      showCopy: typeof overrides.showCopy === 'boolean' ? overrides.showCopy : Boolean(copy),
      label: savedText(overrides.label, initial.label, 26) || initial.label,
      art: Object.hasOwn(config.artwork, overrides.art) || editedImage.test(overrides.art) ? overrides.art : initial.art
    };
    const node = screen.querySelector('[data-home-offer="' + id + '"]');
    const variants = { [node.dataset.homeVariant]: node };
    for (const alternate of offerTemplate.querySelectorAll('[data-home-offer="' + id + '"]')) {
      variants[alternate.dataset.homeVariant] = alternate.cloneNode(true);
    }
    return [id, { initial, state, variants }];
  }));

  const dismissed = new Set();
  let activeBanner = markerList.querySelector('[aria-pressed="true"]').dataset.homeBanner;
  let slides = [];
  let swipeStart;

  function saveSettings(status, placements = new Map()) {
    try {
      // Store overrides only, so built-in offers can still receive copy changes in future builds.
      const overrides = Object.fromEntries([...entries].map(([id, { initial, state }]) => [
        id, Object.fromEntries(Object.entries({ ...state, section: placements.get(id) ?? state.section }).filter(([key, value]) => value !== initial[key]))
      ]).filter(([, settings]) => Object.keys(settings).length));
      localStorage.setItem(storageKey, JSON.stringify(overrides));
      status.textContent = 'Изменения сохранены';
      return true;
    } catch {
      status.textContent = 'Изменения применены, но браузер не смог их сохранить';
      return false;
    }
  }

  function maskAmounts() {
    const masking = privacy.getAttribute('aria-pressed') === 'true';
    for (const amount of screen.querySelectorAll('[data-home-amount]')) {
      amount.dataset.homeAmount ||= amount.textContent;
      amount.textContent = masking ? '••••' : amount.dataset.homeAmount;
    }
  }

  function updateContent(node, state) {
    const title = node.querySelector('[data-offer-title]');
    const copy = node.querySelector('[data-offer-copy]');
    const label = node.querySelector('[data-offer-label]');
    const art = node.querySelector('.home-banner-art, .home-row-art img, .home-exchange-art img');
    const custom = state.art !== entries.get(node.dataset.homeOffer).initial.art;
    title.textContent = state.title;
    if (title.hasAttribute('data-home-amount')) title.dataset.homeAmount = state.title;
    copy.textContent = state.copy;
    copy.hidden = !state.showCopy || !state.copy;
    if (label) label.textContent = state.label;
    const src = config.artwork[state.art] || state.art;
    if (art.getAttribute('src') !== src) art.src = src;
    node.toggleAttribute('data-home-custom-art', custom);
    const giftShape = node.querySelector('.home-banner-shape');
    if (giftShape) giftShape.hidden = custom;
  }

  function selectBanner(id) {
    activeBanner = id;
    for (const slide of slides) slide.hidden = slide.dataset.homeOffer !== id;
    for (const dot of markerList.children) dot.setAttribute('aria-pressed', String(dot.dataset.homeBanner === id));
  }

  function renderOffers() {
    slides = [];
    for (const [id, { state, variants }] of entries) {
      for (const node of Object.values(variants)) node.remove();
      const isDismissed = !state.enabled || dismissed.has(id);
      const section = placementDraft.get(id) ?? state.section;
      const variant = isDismissed ? 'row' : section === 'banners' ? 'banner' : section === 'exchange' && variants.exchange ? 'exchange' : 'row';
      const node = variants[variant];
      node.hidden = false;
      updateContent(node, state);
      const dismiss = node.querySelector('[data-home-dismiss]');
      if (dismiss) {
        dismiss.dataset.homeDismiss = isDismissed ? 'restore' : '';
        dismiss.setAttribute('aria-label', (isDismissed ? 'Вернуть предложение ' : 'Скрыть предложение ') + state.title.replaceAll('\n', ' '));
      }
      (isDismissed ? hiddenList : slots.get(section)).append(node);
      if (variant === 'banner') slides.push(node);
    }
    slider.hidden = slides.length === 0;
    slots.get('top').hidden = !slots.get('top').children.length;
    slots.get('exchange').hidden = !slots.get('exchange').children.length;
    hiddenEmpty.hidden = !!hiddenList.children.length;
    markerList.replaceChildren(...slides.map((slide, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.dataset.homeBanner = slide.dataset.homeOffer;
      dot.setAttribute('aria-label', 'Предложение ' + (index + 1));
      return dot;
    }));
    markerList.hidden = slides.length < 2;
    selectBanner(slides.some(slide => slide.dataset.homeOffer === activeBanner) ? activeBanner : slides[0]?.dataset.homeOffer);
    for (const [id, card] of settings) {
      const { state } = entries.get(id);
      const title = state.title.replaceAll('\n', ' ');
      const toggle = card.querySelector('[data-home-offer-visible]');
      card.querySelector('[data-home-setting-title]').textContent = title;
      toggle.checked = state.enabled;
      toggle.setAttribute('aria-label', 'Показывать оффер «' + title + '»');
    }
    maskAmounts();
  }

  function stepBanner(direction) {
    if (slides.length < 2) return;
    const index = slides.findIndex(slide => slide.dataset.homeOffer === activeBanner);
    selectBanner(slides[(index + direction + slides.length) % slides.length].dataset.homeOffer);
  }

  privacy.addEventListener('click', () => {
    const masking = privacy.getAttribute('aria-pressed') !== 'true';
    privacy.setAttribute('aria-pressed', String(masking));
    privacy.setAttribute('aria-label', masking ? 'Показать суммы' : 'Скрыть суммы');
    maskAmounts();
  });

  screen.addEventListener('click', event => {
    const dismiss = event.target.closest('[data-home-dismiss]');
    if (!dismiss) return;
    const id = dismiss.closest('[data-home-offer]').dataset.homeOffer;
    const { state } = entries.get(id);
    const restoring = dismiss.dataset.homeDismiss === 'restore';
    if (settings.has(id) || !state.enabled) {
      state.enabled = restoring;
      saveSettings(settings.get(id)?.querySelector('[role="status"]') || layoutStatus);
    } else if (restoring) dismissed.delete(id);
    else dismissed.add(id);
    renderOffers();
    if (restoring) {
      const restored = screen.querySelector('[data-home-offer="' + id + '"]');
      restored.querySelector('[data-home-dismiss], [data-offer-label]')?.focus({ preventScroll: true });
    } else hiddenSummary.focus({ preventScroll: true });
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-home-settings]')) return;
    controls.open = true;
    controls.querySelector('summary').focus({ preventScroll: true });
  });

  slider.addEventListener('click', event => {
    const dot = event.target.closest('[data-home-banner]');
    if (dot) selectBanner(dot.dataset.homeBanner);
  });
  slider.addEventListener('keydown', event => {
    if (event.target.closest('[data-home-grip]')) return;
    const directions = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };
    const direction = directions[event.key];
    if (!direction || slides.length < 2) return;
    event.preventDefault();
    stepBanner(direction);
    markerList.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  });
  slider.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    slider.setPointerCapture(event.pointerId);
  });
  slider.addEventListener('pointerup', event => {
    if (swipeStart?.id !== event.pointerId) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > Math.max(32, Math.abs(dy) * 1.2)) stepBanner(dx < 0 ? 1 : -1);
  });
  slider.addEventListener('pointercancel', () => { swipeStart = null; });
  slider.addEventListener('lostpointercapture', () => { swipeStart = null; });

  function moveOffer(id, section) {
    const { state } = entries.get(id);
    if ((placementDraft.get(id) ?? state.section) === section) return false;
    if (state.section === section) placementDraft.delete(id);
    else placementDraft.set(id, section);
    if (section === 'banners') activeBanner = id;
    layoutSave.hidden = !placementDraft.size;
    layoutSave.textContent = 'Сохранить';
    renderOffers();
    layoutStatus.textContent = 'Оффер перенесён в раздел «' + config.sections[section] + '»';
    return true;
  }

  layoutSave.addEventListener('click', () => {
    if (!saveSettings(layoutStatus, placementDraft)) {
      layoutSave.textContent = 'Повторить сохранение';
      return;
    }
    for (const [id, section] of placementDraft) entries.get(id).state.section = section;
    placementDraft.clear();
    layoutSave.hidden = true;
  });

  async function prepareImage(file) {
    if (!/^image\/(?:png|jpeg|webp|avif)$/.test(file.type)) throw Error('Выберите PNG, JPEG, WebP или AVIF');
    const reference = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = reference;
      await image.decode();
      const size = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * size));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * size));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', .86);
    } finally { URL.revokeObjectURL(reference); }
  }

  for (const [id, card] of settings) {
    const { initial, state } = entries.get(id);
    const status = card.querySelector('[role="status"]');
    const visibility = card.querySelector('[data-home-offer-visible]');
    const form = card.querySelector('form');
    const fields = form.elements;
    const preview = form.querySelector('.home-settings-image');
    const uploadedOption = fields.art.querySelector('[value="uploaded"]');
    const submit = form.querySelector('[type="submit"]');
    const reset = form.querySelector('[data-home-content-reset]');

    function syncContent() {
      fields.title.value = state.title;
      fields.copy.value = state.copy;
      fields.showCopy.checked = state.showCopy;
      fields.copy.disabled = !state.showCopy;
      const uploaded = editedImage.test(state.art);
      uploadedOption.hidden = !uploaded;
      fields.art.value = uploaded ? 'uploaded' : state.art;
      fields.image.value = '';
      preview.src = config.artwork[state.art] || state.art;
      preview.hidden = false;
    }

    visibility.addEventListener('change', () => {
      state.enabled = visibility.checked;
      dismissed.delete(id);
      renderOffers();
      saveSettings(status);
    });
    fields.showCopy.addEventListener('change', () => { fields.copy.disabled = !fields.showCopy.checked; });
    fields.art.addEventListener('change', () => {
      fields.image.value = '';
      preview.src = fields.art.value === 'uploaded' ? state.art : config.artwork[fields.art.value];
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const title = fields.title.value.trim();
      if (!title) { status.textContent = 'Введите заголовок оффера'; fields.title.focus(); return; }
      const copy = fields.copy.value.trim();
      const showCopy = fields.showCopy.checked;
      const file = fields.image.files[0];
      let art = fields.art.value === 'uploaded' ? state.art : fields.art.value;
      if (file) {
        submit.disabled = true;
        reset.disabled = true;
        try { art = await prepareImage(file); }
        catch { status.textContent = 'Не удалось открыть картинку. Выберите PNG, JPEG, WebP или AVIF'; return; }
        finally { submit.disabled = false; reset.disabled = false; }
      }
      Object.assign(state, { title, copy, showCopy, art });
      renderOffers();
      syncContent();
      saveSettings(status);
    });
    reset.addEventListener('click', () => {
      const { title, copy, showCopy, art } = initial;
      Object.assign(state, { title, copy, showCopy, art });
      renderOffers();
      syncContent();
      saveSettings(status);
    });
    syncContent();
  }

  renderOffers();
  mountHomeOfferDrag(screen, moveOffer);
})();

function mountHomeOfferDrag(screen, moveOffer) {
  const scroller = screen.querySelector('#scrollArea');
  const header = screen.querySelector('.home-header');
  const tabs = screen.querySelector('.bottom-bar');
  const targets = [...scroller.querySelectorAll('[data-home-drop]')];
  let press;
  let drag;
  let animation;
  let revealed;
  let suppressClick = false;
  let clickTimer;

  function reveal(card) {
    revealed?.removeAttribute('data-home-grip-visible');
    revealed = card;
    revealed?.setAttribute('data-home-grip-visible', '');
  }

  function editableCard(target) {
    return target.closest('[data-home-editable]:not(#home-hidden-offers *)');
  }

  function viewportBounds() {
    const rect = scroller.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: Math.max(rect.top, header.getBoundingClientRect().bottom, 0),
      bottom: Math.min(rect.bottom, tabs.getBoundingClientRect().top, innerHeight)
    };
  }

  function updateTarget(bounds) {
    const { x, y } = press;
    const inside = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    const next = inside ? targets.find(area => {
      const rect = area.getBoundingClientRect();
      return rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }) : null;
    if (next === drag.target) return;
    drag.target?.classList.remove('home-drop-highlight');
    drag.target = next;
    drag.target?.classList.add('home-drop-highlight');
  }

  function paintDrag() {
    const bounds = viewportBounds();
    const { x, y } = press;
    drag.ghost.style.transform = 'translate3d(' + (x - drag.offsetX) + 'px,' + (y - drag.offsetY) + 'px,0) scale(' + drag.scale + ')';
    if (x >= bounds.left && x <= bounds.right && y >= bounds.top - 28 && y <= bounds.bottom + 42) {
      const edge = 72;
      const velocity = Math.max(0, edge - (bounds.bottom - y)) - Math.max(0, edge - (y - bounds.top));
      if (velocity) scroller.scrollTop += Math.max(-20, Math.min(20, velocity / 4)) / drag.scale;
    }
    updateTarget(bounds);
    animation = requestAnimationFrame(paintDrag);
  }

  function startDrag() {
    const card = press.card;
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add('home-offer-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.style.width = card.offsetWidth + 'px';
    ghost.style.height = card.offsetHeight + 'px';
    document.body.append(ghost);
    drag = {
      ghost, target: null, scale: rect.width / card.offsetWidth,
      offsetX: press.startX - rect.left, offsetY: press.startY - rect.top
    };
    card.setAttribute('data-home-drag-source', '');
    screen.classList.add('is-home-offer-dragging');
    scroller.setPointerCapture(press.id);
    paintDrag();
  }

  function finishPress(drop) {
    if (!press) return;
    clearTimeout(press.timer);
    const { id, card, ready } = press;
    if (ready) {
      suppressClick = true;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { suppressClick = false; }, 250);
    }
    const target = drag?.target;
    if (drag) {
      cancelAnimationFrame(animation);
      target?.classList.remove('home-drop-highlight');
      drag.ghost.remove();
      card.removeAttribute('data-home-drag-source');
      screen.classList.remove('is-home-offer-dragging');
      reveal(null);
    }
    drag = null;
    press = null;
    if (scroller.hasPointerCapture(id)) scroller.releasePointerCapture(id);
    if (drop && target) moveOffer(card.dataset.homeOffer, target.dataset.homeDrop);
  }

  scroller.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || press) return;
    const card = editableCard(event.target);
    if (revealed !== card) reveal(null);
    if (!card || event.target.closest('[data-home-dismiss]')) return;
    const onGrip = !!event.target.closest('[data-home-grip]');
    press = { id: event.pointerId, card, x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY, ready: onGrip };
    if (onGrip) return;
    press.timer = setTimeout(() => {
      press.ready = true;
      reveal(card);
    }, 500);
  });
  window.addEventListener('pointermove', event => {
    if (press?.id !== event.pointerId) return;
    press.x = event.clientX;
    press.y = event.clientY;
    const distance = Math.hypot(press.x - press.startX, press.y - press.startY);
    if (!press.ready && distance > 7) finishPress(false);
    else if (press.ready && !drag && distance > 4) startDrag();
  });
  window.addEventListener('pointerup', event => {
    if (press?.id !== event.pointerId) return;
    press.x = event.clientX;
    press.y = event.clientY;
    if (drag) updateTarget(viewportBounds());
    finishPress(true);
  });
  window.addEventListener('pointercancel', event => {
    if (press?.id === event.pointerId) finishPress(false);
  });
  window.addEventListener('blur', () => finishPress(false));
  scroller.addEventListener('lostpointercapture', event => {
    if (event.target === scroller && press?.id === event.pointerId) finishPress(false);
  });
  scroller.addEventListener('contextmenu', event => {
    if (press?.ready && editableCard(event.target)) event.preventDefault();
  });
  screen.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  scroller.addEventListener('keydown', event => {
    if (event.key === 'Escape' && press) { event.preventDefault(); finishPress(false); return; }
    const grip = event.target.closest('[data-home-grip]');
    const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!grip || !direction) return;
    event.preventDefault();
    const card = editableCard(grip);
    if (!card) return;
    const section = card.closest('[data-home-drop]');
    const target = targets[targets.indexOf(section) + direction];
    if (!target || !moveOffer(card.dataset.homeOffer, target.dataset.homeDrop)) return;
    const moved = scroller.querySelector('[data-home-offer="' + card.dataset.homeOffer + '"]');
    reveal(moved);
    moved.querySelector('[data-home-grip]').focus();
  });
}
