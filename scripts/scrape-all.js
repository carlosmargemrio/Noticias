/*  scripts/scrape-all.js
    Raspador de:
      – IPHAN
      – Brasil 247
      – Periódicos CAPES
    ⟶ atualiza **apenas** noticias_sites em noticias.json
------------------------------------------------------- */

const fs    = require('fs');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const OUT_FILE     = 'noticias.json';
const MAX_POR_SITE = 3;
const TIMEOUT_MS   = 25_000;

/* ---------- fetch com timeout ---------- */
function fetchHtml (url) {
  return new Promise((res, rej) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    fetch(url, { signal: ctrl.signal })
      .then(r => r.text().then(t => { clearTimeout(id); r.ok ? res(t) : rej(new Error(r.status)); }))
      .catch(rej);
  });
}

/* ---------- helpers de scraping ---------- */
function scrapeIphan (html) {
  const doc = new JSDOM(html).window.document;
  const ul  = doc.querySelector('.noticias.listagem-noticias-com-foto');
  if (!ul) return [];

  return [...ul.querySelectorAll('li')].slice(0, MAX_POR_SITE).map(li => ({
    titulo : li.querySelector('.titulo a')?.textContent.trim() || '',
    data   : li.querySelector('.descricao .data')?.textContent.trim() || '',
    resumo : li.querySelector('.descricao')?.textContent.trim().replace(/\s+/g,' ') || '',
    imagem : li.querySelector('img')?.src.replace('/mini','') || '',
    link   : li.querySelector('.titulo a')?.href || '',
    fonte  : 'IPHAN'
  }));
}

function scrapeBrasil247 (html) {
  const doc = new JSDOM(html).window.document;
  return [...doc.querySelectorAll('article')].slice(0, MAX_POR_SITE).map(a => ({
    titulo : a.querySelector('h2,h3')?.textContent.trim() || '',
    data   : a.querySelector('time')?.getAttribute('datetime') || '',
    resumo : a.querySelector('p')?.textContent.trim() || '',
    imagem : a.querySelector('img')?.src || '',
    link   : a.querySelector('h2 a,h3 a')?.href || '',
    fonte  : 'Brasil 247'
  }));
}

function scrapeCapes (html) {
  const doc = new JSDOM(html).window.document;
  return [...doc.querySelectorAll('.row.govbr-items-leading')]
         .slice(0, MAX_POR_SITE)
         .map(div => ({
           titulo : div.querySelector('.titulo a')?.textContent.trim() || '',
           data   : (div.querySelector('p')?.textContent.split('-')[0] || '').trim(),
           resumo : div.querySelector('p')?.textContent.replace(/^[^—]*—/,'').trim(),
           imagem : div.querySelector('img')?.src || '',
           link   : div.querySelector('.titulo a')?.href || '',
           fonte  : 'Periódicos CAPES'
         }));
}

/* ---------- pipeline principal ---------- */
(async () => {

  /* 1. raspagem */
  const sites = [
    { nome:'IPHAN',     url:'https://www.gov.br/iphan/pt-br/assuntos/noticias',                fn:scrapeIphan },
    { nome:'Brasil247', url:'https://www.brasil247.com/cultura',                               fn:scrapeBrasil247 },
    { nome:'CAPES',     url:'https://www.periodicos.capes.gov.br/index.php/informativos.html', fn:scrapeCapes }
  ];

  let novasSites = [];

  for (const s of sites) {
    try {
      console.log(`🔎  Buscando página de ${s.nome}…`);
      const html = await fetchHtml(s.url);
      novasSites.push(...s.fn(html));
    } catch (err) {
      console.error(`⚠️  ${s.nome} falhou (${err.message}). Pulando…`);
    }
  }

  /* 2. carrega JSON antigo ou inicia vazio */
  let antigo = { noticias_sites: [], noticias_escritorio: [] };
  if (fs.existsSync(OUT_FILE)) {
    try { antigo = JSON.parse(fs.readFileSync(OUT_FILE,'utf8')); } catch {}
  }

  /* 3. mantém o bloco “escritorio” exatamente como está */
  const novo = {
    noticias_sites      : novasSites,
    noticias_escritorio : antigo.noticias_escritorio       // ← permanece intacto
  };

  /* 4. grava apenas se o bloco sites mudou */
  if (JSON.stringify(novo.noticias_sites) === JSON.stringify(antigo.noticias_sites)) {
    console.log('🔁  Nenhuma mudança em noticias_sites – JSON mantido.');
    return;
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(novo, null, 2));
  console.log('✅  noticias_sites atualizado, noticias_escritorio preservado.');
})();
