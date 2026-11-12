(() => {
  const storageKey = 'otp-prototype-display-v3';
  const mobile = matchMedia('(max-width:650px), (hover:none) and (pointer:coarse)');
  const toggle = document.querySelector('#showDeviceChrome');
  const mode = () => mobile.matches ? 'mobile' : 'desktop';
  const lightweight = CSS.supports('-webkit-touch-callout', 'none') ||
    new URLSearchParams(location.search).get('render') === 'light';
  document.body.classList.toggle('lightweight-rendering', lightweight);

  function readPreference() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (typeof saved?.[mode()] === 'boolean') return saved[mode()];
      if (!mobile.matches) {
        const previous = JSON.parse(localStorage.getItem('otp-prototype-display-v2'));
        if (typeof previous?.showDeviceChrome === 'boolean') return previous.showDeviceChrome;
        const legacy = JSON.parse(localStorage.getItem('otp-prototype-display-v1'));
        if (legacy && Object.values(legacy).includes(false)) return false;
      }
    } catch {}
    return !mobile.matches;
  }

  let showChrome = readPreference();

  function fitDevice() {
    const width = document.documentElement.clientWidth || innerWidth;
    const scale = showChrome && !mobile.matches ? Math.max(.24, Math.min(1, (width - 32) / 409)) : 1;
    document.documentElement.style.setProperty('--device-scale', scale);
  }

  function applyPreference() {
    for (const part of ['status', 'frame', 'home']) {
      document.body.classList.toggle('hide-' + part, !showChrome);
    }
    toggle.checked = showChrome;
    fitDevice();
  }

  toggle.addEventListener('change', () => {
    showChrome = toggle.checked;
    applyPreference();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey)) || {};
      localStorage.setItem(storageKey, JSON.stringify({ ...saved, [mode()]: showChrome }));
    } catch {}
  });
  mobile.addEventListener('change', () => {
    showChrome = readPreference();
    applyPreference();
  });
  addEventListener('resize', fitDevice);
  window.visualViewport?.addEventListener('resize', fitDevice);
  applyPreference();
})();
