// Built-in texts (English + Hungarian). Anything listed in SETTING_GROUPS can be overridden from the admin panel;
// an empty admin field always falls back to the text here.
export const LANGS = ['en', 'hu'];

export const STR = {
  meta_title: { en: 'EATEC Construction | Drywall, ceilings and partitions', hu: 'EATEC Construction | Gipszkarton, álmennyezet és válaszfal' },
  meta_description: {
    en: 'EATEC Construction builds suspended ceilings, partition walls and 3D complex gypsumboard for retail and commercial interiors across Europe.',
    hu: 'Az EATEC Construction álmennyezeteket, válaszfalakat és 3D komplex gipszkarton elemeket készít kereskedelmi és üzleti belterekhez egész Európában.',
  },
  skip: { en: 'Skip to content', hu: 'Ugrás a tartalomra' },
  nav_projects: { en: 'Projects', hu: 'Projektek' },
  nav_apps: { en: 'Applications', hu: 'Megoldásaink' },
  nav_corp: { en: 'Corporate', hu: 'Cégünk' },
  cta_contact: { en: 'Contact us', hu: 'Kapcsolatfelvétel' },
  cta_projects: { en: 'View projects', hu: 'Projektek megtekintése' },
  hero_title: { en: 'Ceilings and walls, built to the drawing.', hu: 'Mennyezetek és falak, pontosan a tervek szerint.' },
  hero_sub: {
    en: 'Suspended ceilings, partition walls and curved gypsumboard for retail and commercial interiors across Europe.',
    hu: 'Álmennyezetek, válaszfalak és íves gipszkarton elemek kereskedelmi és üzleti belterekhez, egész Európában.',
  },
  clients_label: { en: 'Trusted by', hu: 'Megbízóink' },
  projects_title: { en: 'Selected projects', hu: 'Válogatott projektek' },
  apps_title: { en: 'What we build', hu: 'Amit építünk' },
  corp_text: { en: '', hu: '' },
  years_value: { en: '20+', hu: '20+' },
  years_label: { en: 'years of experience', hu: 'év tapasztalat' },
  countries_label: { en: 'countries', hu: 'ország' },
  projects_label: { en: 'projects shown', hu: 'bemutatott projekt' },
  policies_title: { en: 'Our policies', hu: 'Irányelveink' },
  contact_title: { en: 'Tell us about your project.', hu: 'Mesélje el, min dolgozik.' },
  address_label: { en: 'Address', hu: 'Cím' },
  phone_label: { en: 'Phone', hu: 'Telefon' },
  hours_label: { en: 'Office hours', hu: 'Nyitvatartás' },
  hours: { en: 'Monday to Friday', hu: 'Hétfőtől péntekig' },
  chips_all: { en: 'All', hu: 'Összes' },
  filter_label: { en: 'Filter by country', hu: 'Szűrés ország szerint' },
  rail_prev: { en: 'Previous', hu: 'Előző' },
  rail_next: { en: 'Next', hu: 'Következő' },
  close: { en: 'Close', hu: 'Bezárás' },
  f_name: { en: 'Name', hu: 'Név' },
  f_email: { en: 'Email', hu: 'E-mail' },
  f_phone: { en: 'Phone', hu: 'Telefonszám' },
  f_optional: { en: '(optional)', hu: '(nem kötelező)' },
  f_message: { en: 'Message', hu: 'Üzenet' },
  e_name: { en: 'Please enter your name.', hu: 'Kérjük, adja meg a nevét.' },
  e_email: { en: 'Please enter a valid email address.', hu: 'Kérjük, adjon meg érvényes e-mail címet.' },
  e_message: { en: 'Please describe your project briefly.', hu: 'Kérjük, írja le röviden a projektet.' },
  f_send: { en: 'Send message', hu: 'Üzenet küldése' },
  f_sending: { en: 'Sending...', hu: 'Küldés...' },
  f_ok: { en: 'Thank you. We will reply by email.', hu: 'Köszönjük. E-mailben válaszolunk.' },
  f_fail: { en: 'The message could not be sent. Please email us directly.', hu: 'Az üzenetet nem sikerült elküldeni. Kérjük, írjon nekünk közvetlenül e-mailben.' },
  theme_to_light: { en: 'Switch to light theme', hu: 'Váltás világos témára' },
  theme_to_dark: { en: 'Switch to dark theme', hu: 'Váltás sötét témára' },
  rights: { en: 'All rights reserved', hu: 'Minden jog fenntartva' },
  lang_switch: { en: 'Magyar nyelv', hu: 'English version' },
};

const NUM = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
  hu: ['nulla', 'egy', 'két', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc', 'tíz'],
};
export function corpTitleDefault(lang, n) {
  const w = NUM[lang][n] || String(n);
  return lang === 'hu' ? `Partnereinkkel együtt építünk, ${w} országban.` : `Built with our partners, across ${w} ${n === 1 ? 'country' : 'countries'}.`;
}

// What the admin "Site texts" page shows. langs:true means one field per language.
export const SETTING_GROUPS = [
  { title: 'Hero (top of the page)', fields: [
    { key: 'hero_title', label: 'Headline', type: 'text', langs: true, help: 'One or two lines works best.' },
    { key: 'hero_sub', label: 'Sub text', type: 'textarea', langs: true },
    { key: 'hero_image', label: 'Background photo', type: 'photo', help: 'Wide photo, at least 1600 px. Dark areas near the bottom keep the text readable.' },
    { key: 'cta_contact', label: 'Contact button', type: 'text', langs: true },
    { key: 'cta_projects', label: 'Projects button', type: 'text', langs: true },
  ] },
  { title: 'Section titles', fields: [
    { key: 'clients_label', label: 'Logo strip label', type: 'text', langs: true },
    { key: 'projects_title', label: 'Projects title', type: 'text', langs: true },
    { key: 'apps_title', label: 'Applications title', type: 'text', langs: true },
    { key: 'policies_title', label: 'Policies title', type: 'text', langs: true },
    { key: 'contact_title', label: 'Contact title', type: 'text', langs: true },
  ] },
  { title: 'Corporate section', fields: [
    { key: 'corp_title', label: 'Big statement', type: 'text', langs: true, help: 'Leave empty to use "Built with our partners, across N countries." with N counted from your projects.' },
    { key: 'corp_text', label: 'Text', type: 'textarea', langs: true },
    { key: 'corp_image', label: 'Photo', type: 'photo' },
    { key: 'years_value', label: 'Years of experience (number)', type: 'text' },
    { key: 'years_label', label: 'Years label', type: 'text', langs: true },
    { key: 'countries_label', label: 'Countries label', type: 'text', langs: true },
    { key: 'projects_label', label: 'Projects label', type: 'text', langs: true },
  ] },
  { title: 'Contact details', fields: [
    { key: 'address', label: 'Address', type: 'textarea', langs: true, help: 'One line per row, shown as written.' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text', help: 'Leave empty to hide the phone row.' },
    { key: 'hours', label: 'Office hours', type: 'text', langs: true },
    { key: 'contact_to', label: 'Send form messages to (email)', type: 'text', help: 'Optional. Needs SMTP settings on the server. Messages are always saved under Messages.' },
  ] },
  { title: 'Social media links', fields: [
    { key: 'facebook', label: 'Facebook URL', type: 'text' },
    { key: 'twitter', label: 'X (Twitter) URL', type: 'text' },
    { key: 'instagram', label: 'Instagram URL', type: 'text' },
    { key: 'linkedin', label: 'LinkedIn URL', type: 'text' },
  ] },
  { title: 'Search engines', fields: [
    { key: 'meta_title', label: 'Page title', type: 'text', langs: true },
    { key: 'meta_description', label: 'Page description', type: 'textarea', langs: true },
  ] },
];
