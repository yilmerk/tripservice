// Runs before styles and React to avoid a light flash on dark-mode page loads.
(function () {
  var preference = null;
  try { preference = localStorage.getItem('rota-theme'); } catch (_) { /* Storage can be disabled. */ }
  var dark = preference === 'dark' || (preference !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', Boolean(dark));
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0f172a' : '#fafbf8');
})();
