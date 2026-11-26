(() => {
  mountPrototypeFlows();

  const screen = document.querySelector('.screen');
  const controls = document.querySelector('.prototype-controls');
  const privacy = document.querySelector('#home-privacy');
  const hidden = document.querySelector('#home-hidden-offers');
  const hiddenSummary = document.querySelector('.home-hidden summary');
  const hiddenEmpty = document.querySelector('.home-hidden-empty');
  const offers = new Map();

  privacy.addEventListener('click', () => {
    const masking = privacy.getAttribute('aria-pressed') !== 'true';
    privacy.setAttribute('aria-pressed', String(masking));
    privacy.setAttribute('aria-label', masking ? 'Показать суммы' : 'Скрыть суммы');
    for (const amount of screen.querySelectorAll('[data-home-amount]')) {
      if (masking) amount.dataset.homeAmount = amount.textContent;
      amount.textContent = masking ? '••••' : amount.dataset.homeAmount;
    }
  });

  screen.addEventListener('click', event => {
    const dismiss = event.target.closest('[data-home-dismiss]');
    if (!dismiss) return;
    const row = dismiss.closest('[data-home-offer]');
    const saved = offers.get(row);
    if (saved) {
      saved.position.replaceWith(row);
      dismiss.setAttribute('aria-label', saved.label);
      dismiss.dataset.homeDismiss = '';
      offers.delete(row);
      dismiss.focus({ preventScroll: true });
    } else {
      const position = document.createComment('Offer position');
      offers.set(row, { position, label: dismiss.getAttribute('aria-label') });
      row.before(position);
      hidden.append(row);
      dismiss.setAttribute('aria-label', 'Вернуть предложение в список');
      dismiss.dataset.homeDismiss = 'restore';
      hiddenSummary.focus({ preventScroll: true });
    }
    hiddenEmpty.hidden = offers.size > 0;
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-home-settings]')) return;
    controls.open = true;
    controls.querySelector('summary').focus({ preventScroll: true });
  });

  const slider = document.querySelector('.home-banners');
  const slides = [...slider.querySelectorAll('.home-banner')];
  const dots = [...slider.querySelectorAll('[data-home-banner]')];
  let index = dots.findIndex(dot => dot.getAttribute('aria-pressed') === 'true');
  let swipeStart;

  function selectBanner(nextIndex) {
    index = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, position) => { slide.hidden = position !== index; });
    dots.forEach((dot, position) => { dot.setAttribute('aria-pressed', String(position === index)); });
  }

  slider.addEventListener('click', event => {
    const dot = event.target.closest('[data-home-banner]');
    if (dot) selectBanner(Number(dot.dataset.homeBanner));
  });
  slider.addEventListener('keydown', event => {
    const directions = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    selectBanner(index + direction);
    dots[index].focus({ preventScroll: true });
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
    if (Math.abs(dx) > Math.max(32, Math.abs(dy) * 1.2)) selectBanner(index + (dx < 0 ? 1 : -1));
  });
  slider.addEventListener('pointercancel', () => { swipeStart = null; });
})();
