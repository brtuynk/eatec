(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* theme toggle: remembered choice, otherwise the system setting */
  (function () {
    var btn = $('#theme'), root = document.documentElement, meta = $('#theme-color');
    if (!btn) return;
    function apply(t, save) {
      root.setAttribute('data-theme', t);
      if (meta) meta.setAttribute('content', t === 'light' ? '#EEF0EE' : '#0A0A09');
      btn.setAttribute('aria-label', t === 'light' ? btn.dataset.toDark : btn.dataset.toLight);
      if (save) { try { localStorage.setItem('theme', t); } catch (e) {} }
    }
    apply(root.getAttribute('data-theme') || 'dark', false);
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      if (!reduce) { root.classList.add('theme-anim'); setTimeout(function () { root.classList.remove('theme-anim'); }, 450); }
      apply(next, true);
    });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
      var saved = null; try { saved = localStorage.getItem('theme'); } catch (x) {}
      if (!saved) apply(e.matches ? 'light' : 'dark', false);
    });
  })();

  /* headline words: rise on load (hero) and light up on scroll (statement) */
  $$('.split').forEach(function (el) {
    var txt = el.textContent.trim();
    el.setAttribute('aria-label', txt);
    el.innerHTML = txt.split(/\s+/).map(function (w, i) {
      return '<span class="w" aria-hidden="true"><span style="--i:' + i + '">' + esc(w) + '</span></span>';
    }).join(' ');
  });

  /* magnetic hero buttons */
  if (matchMedia('(pointer:fine)').matches && !reduce) {
    $$('.hero-cta .btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); b.style.translate = ((e.clientX - r.left - r.width / 2) * .22) + 'px ' + ((e.clientY - r.top - r.height / 2) * .3) + 'px'; });
      b.addEventListener('pointerleave', function () { b.style.translate = ''; });
    });
  }

  /* application cards: soft amber spotlight follows the cursor (pointer devices only) */
  if (matchMedia('(pointer:fine)').matches && !reduce) {
    $$('.app').forEach(function (c) {
      c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    });
  }

  /* projects: country filter, rail buttons, lightbox */
  var grid = $('#pgrid');
  if (grid) {
    var items = $$('.pitem', grid), chips = $$('.chip'), current = 'all', idx = 0;
    var lb = $('#lb'), lbImg = $('#lb-img'), lbCap = $('#lb-cap');
    var visible = function () { return items.filter(function (i) { return !i.hidden; }); };
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        current = c.dataset.filter;
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c); });
        grid.scrollTo({ left: 0 });
        items.forEach(function (i) {
          var on = current === 'all' || i.dataset.country === current;
          i.hidden = !on; i.classList.remove('show'); if (on) { void i.offsetWidth; i.classList.add('show'); }
        });
      });
    });
    var step = function (d) { var c = visible()[0]; if (c) grid.scrollBy({ left: d * (c.getBoundingClientRect().width + 20), behavior: 'smooth' }); };
    $('#rail-prev').addEventListener('click', function () { step(-1); });
    $('#rail-next').addEventListener('click', function () { step(1); });
    var show = function (k) { var v = visible(); idx = (k + v.length) % v.length; var it = v[idx]; lbImg.src = it.dataset.full; lbImg.alt = it.dataset.alt; lbCap.textContent = it.dataset.alt; };
    items.forEach(function (it) { $('.pbtn', it).addEventListener('click', function () { show(visible().indexOf(it)); lb.showModal(); }); });
    $('#lb-prev').addEventListener('click', function () { show(idx - 1); });
    $('#lb-next').addEventListener('click', function () { show(idx + 1); });
    $('#lb-close').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); });
  }

  /* policy tabs */
  var tabs = $$('.tab'), panels = $$('.panel');
  function pick(t, focus) { tabs.forEach(function (x, i) { var on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; panels[i].hidden = !on; }); if (focus) t.focus(); }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { pick(t); });
    t.addEventListener('keydown', function (e) {
      var k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (!k) return;
      e.preventDefault(); pick(tabs[(i + k + tabs.length) % tabs.length], true);
    });
  });

  /* contact form */
  var form = $('#form');
  if (form) {
    var status = $('#status'), send = $('#send');
    form.addEventListener('submit', function (e) {
      e.preventDefault(); status.textContent = '';
      var bad = null;
      ['name', 'email', 'message'].forEach(function (id) {
        var el = form.elements[id], f = el.closest('.field'), ok = el.value.trim() && el.checkValidity();
        if (!ok) { f.setAttribute('data-invalid', ''); el.setAttribute('aria-invalid', 'true'); bad = bad || el; }
        else { f.removeAttribute('data-invalid'); el.removeAttribute('aria-invalid'); }
      });
      if (bad) { bad.focus(); return; }
      send.disabled = true; status.textContent = form.dataset.sending;
      fetch('/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.elements.name.value, email: form.elements.email.value, phone: form.elements.phone.value, message: form.elements.message.value, website: form.elements.website.value }),
      }).then(function (r) { if (!r.ok) throw new Error(r.status); status.textContent = form.dataset.ok; form.reset(); })
        .catch(function () { status.textContent = form.dataset.fail; })
        .then(function () { send.disabled = false; });
    });
  }
})();
