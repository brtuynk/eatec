(function () {
  var t;
  try { t = localStorage.getItem('theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  var m = document.getElementById('theme-color');
  if (m) m.setAttribute('content', t === 'light' ? '#EEF0EE' : '#0A0A09');
})();
