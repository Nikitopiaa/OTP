(() => {
  const scrollArea = document.querySelector('#scrollArea');
  const screen = scrollArea.parentElement;
  const gift = document.querySelector('#gift');
  const giftToggle = document.querySelector('#giftToggleButton');
  const controls = document.querySelector('.prototype-controls');
  const backdrop = document.querySelector('#sheetBackdrop');
  const sheet = backdrop.querySelector('.bottom-sheet');
  const closeButton = sheet.querySelector('.sheet-close');
  const modalBackground = [scrollArea, gift, screen.querySelector('.bottom-bar'), controls];
  let previousFocus;

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
  }

  function closeSheet() {
    backdrop.hidden = true;
    for (const element of modalBackground) element.inert = false;
    previousFocus?.focus({ preventScroll: true });
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
