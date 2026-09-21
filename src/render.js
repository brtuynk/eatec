import fs from 'node:fs';
import path from 'node:path';
import { all, getSettings } from './db.js';
import { config, paths } from './config.js';
import { STR, corpTitleDefault } from './i18n.js';
import { icon } from './icons.js';
import { imgTag, imgUrl } from './images.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paras = (t) => String(t || '').replace(/\r/g, '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const lines = (t) => String(t || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);

// version string for cache-busting /assets files
const assetV = (f) => { try { return Math.floor(fs.statSync(path.join(paths.public, f)).mtimeMs / 1000); } catch { return 0; } };

export function renderPage(lang) {
  const other = lang === 'en' ? 'hu' : 'en';
  const S = getSettings();
  const T = (key) => S[`${key}|${lang}`] || S[`${key}|`] || STR[key]?.[lang] || '';
  const G = (key) => S[`${key}|`] || '';

  const services = all('services');
  const projects = all('projects');
  const brands = all('brands');
  const policies = all('policies');
  const countries = [...new Set(projects.map((p) => p.country_en).filter(Boolean))];
  const countryLabel = (p) => (lang === 'hu' ? p.country_hu || p.country_en : p.country_en);
  const countryName = (en) => (lang === 'hu' ? projects.find((p) => p.country_en === en)?.country_hu || en : en);

  const heroImg = G('hero_image');
  const corpImg = G('corp_image');
  const corpTitle = S[`corp_title|${lang}`] || corpTitleDefault(lang, countries.length);
  const corpText = S[`corp_text|${lang}`] || '';
  const address = S[`address|${lang}`] || S['address|en'] || '';
  const addressLines = (() => { const l = lines(address); if (l.length > 1) return l; return address.replace(/(Kft\.)\s+/i, '$1\n').replace(/(\d+\.)\s+(\d{4}\s)/, '$1\n$2').split('\n').map((x) => x.trim()).filter(Boolean); })();
  const email = G('email');
  const phone = G('phone');
  const socials = [['facebook', 'Facebook'], ['twitter', 'X'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn']].filter(([k]) => G(k));

  const base = config.siteUrl;
  const url = (l) => `${base}${l === 'hu' ? '/hu/' : '/'}`;
  const title = T('meta_title');
  const desc = T('meta_description');
  const heroOg = heroImg ? base + imgUrl(heroImg, 1200) : '';
  const heroPreload = heroImg && !heroImg.endsWith('-logo.png') ? (() => {
    const [b, w] = heroImg.split('|'); const ws = w.split(',');
    return `<link rel="preload" as="image" href="/uploads/${b}-${ws.at(-1)}.webp" imagesrcset="${ws.map((x) => `/uploads/${b}-${x}.webp ${x}w`).join(', ')}" imagesizes="100vw" fetchpriority="high">`;
  })() : '';

  const ld = {
    '@context': 'https://schema.org', '@type': 'GeneralContractor', name: 'EATEC Construction Kft.', url: base + '/',
    logo: base + '/assets/img/logo-light.png', ...(email ? { email } : {}), ...(phone ? { telephone: phone } : {}),
    address: { '@type': 'PostalAddress', streetAddress: lines(S['address|en'] || '').join(', '), addressCountry: 'HU' },
    ...(socials.length ? { sameAs: socials.map(([k]) => G(k)) } : {}),
  };

  const brandItems = brands.map((b) => `<li>${imgTag(b.image, { alt: b.name })}</li>`).join('');
  const dupItems = (brandItems + brandItems).replace(/<li>/g, '<li data-dup aria-hidden="true">').replace(/alt="[^"]*"/g, 'alt=""');

  const appsHtml = services.map((s) => {
    const tt = s[`title_${lang}`] || s.title_en;
    const dd = s[`desc_${lang}`] || s.desc_en;
    const label = s[`link_label_${lang}`] || s.link_label_en || s.link_url;
    return `<article class="app">${imgTag(s.image, { alt: tt, sizes: '(max-width:820px) 100vw, 40vw' })}
        <div class="txt"><h3>${esc(tt)}</h3>${paras(dd).map((p) => `<p>${esc(p)}</p>`).join('')}${s.link_url ? `<a class="ext" href="${esc(s.link_url)}" target="_blank" rel="noopener">${esc(label)} ${icon('arrow-up-right')}</a>` : ''}</div></article>`;
  }).join('\n      ');

  const chips = [`<button type="button" class="chip" data-filter="all" aria-pressed="true">${esc(T('chips_all'))} (${projects.length})</button>`]
    .concat(countries.map((c) => `<button type="button" class="chip" data-filter="${esc(c)}" aria-pressed="false">${esc(countryName(c))} (${projects.filter((p) => p.country_en === c).length})</button>`)).join('');

  const projHtml = projects.map((p) => {
    const cap = `${p.name}, ${countryLabel(p)}${p.year ? ` (${p.year})` : ''}`;
    return `<figure class="pitem" data-country="${esc(p.country_en)}" data-full="${imgUrl(p.image, 1600)}" data-alt="${esc(cap)}">
        <button class="pbtn" type="button" aria-label="${esc(cap)}"><div class="pimg">${imgTag(p.image, { alt: cap, sizes: '(max-width:820px) 84vw, 700px' })}</div></button>
        <figcaption class="pcap"><span>${esc(p.name)}</span><span>${esc(countryLabel(p))}${p.year ? ` ${esc(p.year)}` : ''}</span></figcaption></figure>`;
  }).join('\n      ');

  const tabs = policies.map((p, i) => `<button class="tab" role="tab" id="tab${i}" aria-controls="panel${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" type="button">${esc(p[`title_${lang}`] || p.title_en)}</button>`).join('\n        ');
  const panels = policies.map((p, i) => `<div class="panel" role="tabpanel" id="panel${i}" aria-labelledby="tab${i}" tabindex="0"${i === 0 ? '' : ' hidden'}>${paras(p[`body_${lang}`] || p.body_en).map((x) => `<p>${esc(x)}</p>`).join('')}</div>`).join('\n        ');

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" id="theme-color" content="#0A0A09">
<link rel="canonical" href="${url(lang)}">
<link rel="alternate" hreflang="en" href="${url('en')}">
<link rel="alternate" hreflang="hu" href="${url('hu')}">
<link rel="alternate" hreflang="x-default" href="${url('en')}">
<link rel="icon" href="/assets/img/logo-light.png">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url(lang)}">
<meta property="og:locale" content="${lang === 'hu' ? 'hu_HU' : 'en_US'}">
${heroOg ? `<meta property="og:image" content="${heroOg}">` : ''}
<script src="/assets/theme.js"></script>
<link rel="preload" href="/assets/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin>
${heroPreload}
<link rel="stylesheet" href="/assets/fonts.css?v=${assetV('fonts.css')}">
<link rel="stylesheet" href="/assets/site.css?v=${assetV('site.css')}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#main">${esc(T('skip'))}</a>

<header class="nav">
  <a class="logo" href="${lang === 'hu' ? '/hu/' : '/'}#top" aria-label="EATEC Construction"><img class="logo-dark" src="/assets/img/logo-dark.png" alt="EATEC Construction" width="102" height="44"><img class="logo-light" src="/assets/img/logo-light.png" alt="" width="102" height="44"></a>
  <nav aria-label="Main">
    <ul>
      <li><a href="#projects">${esc(T('nav_projects'))}</a></li>
      <li><a href="#applications">${esc(T('nav_apps'))}</a></li>
      <li><a href="#corporate">${esc(T('nav_corp'))}</a></li>
    </ul>
  </nav>
  <div class="nav-actions">
    <button class="theme" id="theme" type="button" data-to-light="${esc(T('theme_to_light'))}" data-to-dark="${esc(T('theme_to_dark'))}" aria-label="${esc(T('theme_to_light'))}">${icon('sun', 'i sun')}${icon('moon', 'i moon')}</button>
    <a class="lang" href="${other === 'hu' ? '/hu/' : '/'}" hreflang="${other}" lang="${other}" aria-label="${esc(STR.lang_switch[lang])}">${other.toUpperCase()}</a>
    <a class="btn btn-primary" href="#contact">${esc(T('cta_contact'))}</a>
  </div>
</header>

<main id="main">
<section class="hero" id="top">
  <div class="hero-stick">
    <div class="hero-media">${imgTag(heroImg, { alt: '', sizes: '100vw', eager: true })}</div>
    <div class="wrap hero-copy">
      <h1 class="split">${esc(T('hero_title'))}</h1>
      <p>${esc(T('hero_sub'))}</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#contact"><span>${esc(T('cta_contact'))}</span></a>
        <a class="btn btn-ghost" href="#projects"><span>${esc(T('cta_projects'))}</span></a>
      </div>
    </div>
  </div>
</section>

${brands.length ? `<section class="clients" aria-labelledby="clients-h">
  <div class="wrap">
    <h2 id="clients-h">${esc(T('clients_label'))}</h2>
    <div class="marquee"><ul id="brands">${brandItems}${dupItems}</ul></div>
  </div>
</section>` : ''}

${projects.length ? `<section id="projects">
  <div class="wrap">
    <div class="proj-head">
      <h2>${esc(T('projects_title'))}</h2>
      <div class="rail-nav"><button type="button" id="rail-prev" aria-label="${esc(T('rail_prev'))}">${icon('arrow-left')}</button><button type="button" id="rail-next" aria-label="${esc(T('rail_next'))}">${icon('arrow-right')}</button></div>
      <div class="chips" id="chips" role="group" aria-label="${esc(T('filter_label'))}">${chips}</div>
    </div>
    <div class="pgrid" id="pgrid">
      ${projHtml}
    </div>
  </div>
</section>` : ''}

${services.length ? `<section id="applications">
  <div class="wrap">
    <h2 class="apps-head">${esc(T('apps_title'))}</h2>
    <div class="apps" id="apps">
      ${appsHtml}
    </div>
  </div>
</section>` : ''}

<section class="corp" id="corporate">
  <div class="wrap">
    <h2 id="statement" class="statement split">${esc(corpTitle)}</h2>
    <div class="grid">
      ${corpImg ? `<figure>${imgTag(corpImg, { alt: '', sizes: '(max-width:820px) 100vw, 40vw' })}</figure>` : ''}
      <div>
        ${paras(corpText).map((p) => `<p class="lead">${esc(p)}</p>`).join('')}
        <dl class="facts">
          <div><dt>${esc(T('years_label'))}</dt><dd>${esc(T('years_value'))}</dd></div>
          <div><dt>${esc(T('countries_label'))}</dt><dd>${countries.length}</dd></div>
          <div><dt>${esc(T('projects_label'))}</dt><dd>${projects.length}</dd></div>
        </dl>
      </div>
    </div>
  </div>
</section>

${policies.length ? `<section id="policies">
  <div class="wrap">
    <h2>${esc(T('policies_title'))}</h2>
    <div class="tabs" id="tabs" role="tablist" aria-label="${esc(T('policies_title'))}">
        ${tabs}
    </div>
    <div class="panels" id="panels">
        ${panels}
    </div>
  </div>
</section>` : ''}

<section class="contact" id="contact">
  <div class="wrap">
    <div class="contact-card">
      <h2 class="split">${esc(T('contact_title'))}</h2>
      ${email ? `<a class="mega" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}
      <div class="contact-grid">
        <dl class="info">
          ${address ? `<div><dt>${icon('map-pin')}<span>${esc(T('address_label'))}</span></dt><dd>${addressLines.map(esc).join('<br>')}</dd></div>` : ''}
          ${phone ? `<div><dt>${icon('phone')}<span>${esc(T('phone_label'))}</span></dt><dd><a href="tel:${esc(phone.replace(/[^\d+]/g, ''))}">${esc(phone)}</a></dd></div>` : ''}
          ${T('hours') ? `<div><dt>${icon('clock')}<span>${esc(T('hours_label'))}</span></dt><dd>${esc(T('hours'))}</dd></div>` : ''}
        </dl>
        <form id="form" novalidate data-ok="${esc(T('f_ok'))}" data-fail="${esc(T('f_fail'))}" data-sending="${esc(T('f_sending'))}">
          <div class="field">
            <label for="name">${esc(T('f_name'))}</label>
            <input id="name" name="name" autocomplete="name" required aria-describedby="name-e">
            <span class="err" id="name-e">${esc(T('e_name'))}</span>
          </div>
          <div class="row">
            <div class="field">
              <label for="email">${esc(T('f_email'))}</label>
              <input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-e">
              <span class="err" id="email-e">${esc(T('e_email'))}</span>
            </div>
            <div class="field">
              <label for="phone">${esc(T('f_phone'))} <span class="opt">${esc(T('f_optional'))}</span></label>
              <input id="phone" name="phone" type="tel" autocomplete="tel">
            </div>
          </div>
          <div class="field">
            <label for="message">${esc(T('f_message'))}</label>
            <textarea id="message" name="message" required aria-describedby="message-e"></textarea>
            <span class="err" id="message-e">${esc(T('e_message'))}</span>
          </div>
          <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
          <div class="form-foot">
            <button class="btn btn-primary" type="submit" id="send"><span>${esc(T('f_send'))}</span></button>
            <p class="status" id="status" role="status" aria-live="polite"></p>
          </div>
        </form>
      </div>
    </div>
  </div>
</section>
</main>

<footer>
  <div class="wrap">
    <span>&copy; ${new Date().getFullYear()} EATEC Construction Kft.</span>
    ${socials.length ? `<span class="social">${socials.map(([k, n]) => `<a href="${esc(G(k))}" target="_blank" rel="noopener">${n}</a>`).join('')}</span>` : ''}
    <span>${esc(T('rights'))}</span>
  </div>
</footer>

<dialog id="lb" aria-label="Project image">
  <img id="lb-img" alt="">
  <div class="lb-bar">
    <p id="lb-cap"></p>
    <div class="lb-nav">
      <button type="button" id="lb-prev" aria-label="${esc(T('rail_prev'))}">${icon('arrow-left')}</button>
      <button type="button" id="lb-next" aria-label="${esc(T('rail_next'))}">${icon('arrow-right')}</button>
      <button type="button" id="lb-close" aria-label="${esc(T('close'))}">${icon('x')}</button>
    </div>
  </div>
</dialog>
<script src="/assets/site.js?v=${assetV('site.js')}" defer></script>
</body>
</html>`;
  return html;
}
