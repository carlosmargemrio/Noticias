/*  scripts/scrape-all.js
    Raspador de:
      – IPHAN
      – Brasil 247
      – Periódicos CAPES
    + “notícias manuais” definidas no próprio script
------------------------------------------------------- */

const fs   = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const OUT_FILE = 'noticias.json';          
const MAX_POR_SITE = 3;                     
const TIMEOUT_MS   = 25_000;

/* ---------- util simples de fetch com timeout ---------- */
function fetchHtml (url) {
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    fetch(url, { signal: ctrl.signal })
      .then(r => r.text().then(t => { clearTimeout(id); r.ok ? resolve(t) : reject(new Error(`${r.status}`)); }))
      .catch(reject);
  });
}

/* ---------- helpers de scraping por site ---------- */
function scrapeIphan (html) {
  const dom = new JSDOM(html);
  const ul  = dom.window.document.querySelector('.noticias.listagem-noticias-com-foto');
  if (!ul) return [];

  return [...ul.querySelectorAll('li')].slice(0, MAX_POR_SITE).map(li => {
    const titulo  = li.querySelector('.titulo a')?.textContent.trim() || '';
    const link    = li.querySelector('.titulo a')?.href || '';
    const data    = li.querySelector('.descricao .data')?.textContent.trim() || '';
    const resumo  = li.querySelector('.descricao')?.textContent.trim().replace(/\s+/g, ' ') || '';
    const imagem  = li.querySelector('img')?.src?.replace('/mini','') || '';
    return { titulo, data, resumo, imagem, link, fonte: 'IPHAN' };
  });
}

function scrapeBrasil247 (html) {
  const dom = new JSDOM(html);
  return [...dom.window.document.querySelectorAll('article')].slice(0, MAX_POR_SITE).map(a=>{
    const titulo = a.querySelector('h2,h3')?.textContent.trim() || '';
    const link   = a.querySelector('h2 a,h3 a')?.href || '';
    const data   = a.querySelector('time')?.getAttribute('datetime') || '';
    const resumo = a.querySelector('p')?.textContent.trim() || '';
    const imagem = a.querySelector('img')?.src || '';
    return { titulo, data, resumo, imagem, link, fonte: 'Brasil 247' };
  });
}

function scrapeCapes (html) {
  const dom = new JSDOM(html);
  return [...dom.window.document.querySelectorAll('.row.govbr-items-leading')]
         .slice(0, MAX_POR_SITE)
         .map(div=>{
            const titulo = div.querySelector('.titulo a')?.textContent.trim() || '';
            const link   = div.querySelector('.titulo a')?.href || '';
            const data   = (div.querySelector('p')?.textContent.split('-')[0]||'').trim();
            const resumo = div.querySelector('p')?.textContent.replace(/^[^—]*—/,'').trim();
            const imagem = div.querySelector('img')?.src || '';
            return { titulo, data, resumo, imagem, link, fonte:'Periódicos CAPES' };
         });
}

/* ---------- notícias fixas que só saem manualmente ---------- */
const noticiasManuais = [
  {
    titulo : 'INSCRIÇÕES ABERTAS – Curso de Educação Patrimonial',
    data   : '26/06/2025',
    resumo : 'Capacitação gratuita promovida pelo ETSRN.',
    imagem : '',
    link   : '',
    fonte  : 'ETSRN'
  }
];

/* ---------- pipeline principal ---------- */
(async () => {
  const sites = [
    { nome:'IPHAN',       url:'https://www.gov.br/iphan/pt-br/assuntos/noticias',            fn:scrapeIphan },
    { nome:'Brasil247',   url:'https://www.brasil247.com/cultura',                           fn:scrapeBrasil247 },
    { nome:'CAPES',       url:'https://www.periodicos.capes.gov.br/index.php/informativos.html', fn:scrapeCapes }
  ];

  let todas = [...noticiasManuais];

  for (const s of sites) {
    try {
      console.log(`🔎  Buscando página de ${s.nome}…`);
      const html = await fetchHtml(s.url);
      todas = [...todas, ...s.fn(html)];
    } catch (err) {
      console.error(`⚠️  ${s.nome} falhou (${err.message}). Pulando…`);
    }
  }

  /* ---- ler JSON antigo (se existir) ---- */
  let antigo = { noticias_sites:[], noticias_escritorio:[] };
  if (fs.existsSync(OUT_FILE)) {
    try {
      antigo = JSON.parse(fs.readFileSync(OUT_FILE,'utf8'));
    } catch { /* arquivo corrompido? começa limpo */ }
  }

  /* ---- atualiza apenas o bloco noticias_sites ---- */
  const novo = {
    ...antigo,
    noticias_sites: todas
  };

  /* ---- detecta mudança real ---- */
  const semData = obj => JSON.stringify(
    { noticias_sites: obj.noticias_sites, noticias_escritorio: obj.noticias_escritorio }
  );
  if (semData(antigo) === semData(novo)) {
    console.log('🔁  Nenhuma mudança real — JSON mantido.');
    return;
  }

  /* ---- salva ---- */
  fs.writeFileSync(OUT_FILE, JSON.stringify(novo));
  console.log('✅  JSON atualizado:', OUT_FILE);
})();
