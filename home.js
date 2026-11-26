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
  const layoutOffer = document.querySelector('#home-layout-offer');
  const visibility = document.querySelector('#home-offer-visible');
  const section = document.querySelector('#home-offer-section');
  const sectionNames = new Map([...section.options].map(option => [option.value, option.textContent]));
  const layoutStatus = document.querySelector('#home-layout-status');
  const form = document.querySelector('#home-offer-content');
  const fields = form.elements;
  const contentStatus = form.querySelector('[role="status"]');
  const preview = form.querySelector('.home-settings-image');
  const uploadedOption = fields.art.querySelector('[value="uploaded"]');
  const storageKey = 'otp-home-offers-v1';

  const config = JSON.parse(document.querySelector('#home-offer-data').textContent);
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
      label: offer.label || 'Подробнее',
      art: offer.art
    };
    const overrides = saved[id] || {};
    const state = {
      section: slots.has(overrides.section) ? overrides.section : initial.section,
      enabled: typeof overrides.enabled === 'boolean' ? overrides.enabled : initial.enabled,
      title: savedText(overrides.title, initial.title, 140) || initial.title,
      copy: savedText(overrides.copy, initial.copy, 300),
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

  function saveSettings(status) {
    try {
      // Store overrides only, so built-in offers can still receive copy changes in future builds.
      const overrides = Object.fromEntries([...entries].map(([id, { initial, state }]) => [
        id, Object.fromEntries(Object.entries(state).filter(([key, value]) => value !== initial[key]))
      ]).filter(([, settings]) => Object.keys(settings).length));
      localStorage.setItem(storageKey, JSON.stringify(overrides));
      status.textContent = 'Изменения сохранены';
    } catch {
      status.textContent = 'Изменения применены, но браузер не смог их сохранить';
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
    copy.hidden = !state.copy;
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
      if (!state.enabled) continue;
      const isDismissed = dismissed.has(id);
      const variant = isDismissed ? 'row' : state.section === 'banners' ? 'banner' : state.section === 'exchange' && variants.exchange ? 'exchange' : 'row';
      const node = variants[variant];
      node.hidden = false;
      updateContent(node, state);
      const dismiss = node.querySelector('[data-home-dismiss]');
      if (dismiss) {
        dismiss.dataset.homeDismiss = isDismissed ? 'restore' : '';
        dismiss.setAttribute('aria-label', (isDismissed ? 'Вернуть предложение ' : 'Скрыть предложение ') + state.title.replaceAll('\n', ' '));
      }
      (isDismissed ? hiddenList : slots.get(state.section)).append(node);
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
    for (const select of [layoutOffer, fields.offer]) {
      for (const option of select.options) {
        const { state } = entries.get(option.value);
        const title = state.title.replaceAll('\n', ' ');
        option.textContent = sectionNames.get(state.section) + ' · ' + title + (state.enabled ? '' : ' · выключен');
      }
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
    const restoring = dismissed.delete(id);
    if (!restoring) dismissed.add(id);
    renderOffers();
    if (restoring) {
      const restored = entries.get(id).variants.row;
      restored.querySelector('[data-home-dismiss]').focus({ preventScroll: true });
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

  function syncLayout() {
    const { state } = entries.get(layoutOffer.value);
    visibility.checked = state.enabled;
    section.value = state.section;
    layoutStatus.textContent = '';
  }

  layoutOffer.addEventListener('change', syncLayout);
  visibility.addEventListener('change', () => {
    const id = layoutOffer.value;
    entries.get(id).state.enabled = visibility.checked;
    if (visibility.checked) dismissed.delete(id);
    renderOffers();
    saveSettings(layoutStatus);
  });
  section.addEventListener('change', () => {
    const id = layoutOffer.value;
    entries.get(id).state.section = section.value;
    dismissed.delete(id);
    renderOffers();
    saveSettings(layoutStatus);
  });

  function syncContent() {
    const { state } = entries.get(fields.offer.value);
    fields.title.value = state.title;
    fields.copy.value = state.copy;
    fields.label.value = state.label;
    const uploaded = editedImage.test(state.art);
    uploadedOption.hidden = !uploaded;
    fields.art.value = uploaded ? 'uploaded' : state.art;
    fields.image.value = '';
    preview.src = config.artwork[state.art] || state.art;
    preview.hidden = false;
  }

  fields.offer.addEventListener('change', () => {
    syncContent();
    contentStatus.textContent = '';
  });
  fields.art.addEventListener('change', () => {
    const { state } = entries.get(fields.offer.value);
    preview.src = fields.art.value === 'uploaded' ? state.art : config.artwork[fields.art.value];
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

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const { state } = entries.get(fields.offer.value);
    const title = fields.title.value.trim();
    if (!title) { contentStatus.textContent = 'Введите заголовок оффера'; fields.title.focus(); return; }
    const copy = fields.copy.value.trim();
    const label = fields.label.value.trim() || 'Подробнее';
    const file = fields.image.files[0];
    let art = fields.art.value === 'uploaded' ? state.art : fields.art.value;
    const submit = form.querySelector('[type="submit"]');
    if (file) {
      submit.disabled = true;
      fields.offer.disabled = true;
      try { art = await prepareImage(file); }
      catch { contentStatus.textContent = 'Не удалось открыть картинку. Выберите PNG, JPEG, WebP или AVIF'; return; }
      finally { submit.disabled = false; fields.offer.disabled = false; }
    }
    Object.assign(state, { title, copy, label, art });
    renderOffers();
    syncContent();
    saveSettings(contentStatus);
  });

  form.querySelector('[data-home-content-reset]').addEventListener('click', () => {
    const { initial, state } = entries.get(fields.offer.value);
    const { title, copy, label, art } = initial;
    Object.assign(state, { title, copy, label, art });
    renderOffers();
    syncContent();
    saveSettings(contentStatus);
  });

  renderOffers();
  syncLayout();
  syncContent();
})();
