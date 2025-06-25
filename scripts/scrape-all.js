// CommonJS → funcionamento garantido no runner
const fs = require('fs');
const fetch = require('node-fetch');      // v2.x
const { JSDOM } = require('jsdom');

const OUTPUT = 'noticias.json';
const MAX_POSTS = 3;

/* ───────────────────────── helpers ───────────────────────── */

async function baixaHTML(url) {
  const res = await fetch(url, { timeout: 30_000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  return res.text();
}

function limpa(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : '';
}

/* ──────────────────────── scraping IPHAN ─────────────────── */

async function pegarIphan() {
  console.log('🔎  Buscando página do IPHAN…');
  const html = await baixaHTML('https://www.gov.br/iphan/pt-br/assuntos/noticias');

  const dom  = new JSDOM(html);
  const doc  = dom.window.document;
  const lis  = Array.from(
    doc.querySelectorAll('.noticias.listagem-noticias-com-foto li')
  ).slice(0, MAX_POSTS);

  return lis.map(li => {
    const a      = li.querySelector('h2.titulo a');
    const titulo = limpa(a?.textContent);
    const link   = a?.href || '';
    const data   = limpa(li.querySelector('.descricao .data')?.textContent);
    const desc   = limpa(li.querySelector('.descricao')?.textContent)
                     .replace(data, '').replace('-', '').trim();
    const img    = (li.querySelector('img')?.src || '').replace('/mini', '');

    return { titulo, data, resumo: desc, imagem: img, link };
  });
}

/* ───────────────────────── main ──────────────────────────── */

(async () => {
  try {
    const noticiasSites = await pegarIphan(); // ↔ adicione outros sites aqui

    // Lê JSON atual (se existir) só para preservar noticias_fixas
    let noticiasFixas = [];
    if (fs.existsSync(OUTPUT)) {
      const atual = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
      noticiasFixas = atual.noticias_fixas || [];

      // Se nada mudou nas notícias dos sites, sai sem erro (workflow succeed)
      if (JSON.stringify(atual.noticias_sites) === JSON.stringify(noticiasSites)) {
        console.log('🔁  Sem alterações em noticias_sites. Encerrando.');
        return;
      }
    }

    const novoJSON = {
      atualizado_em: new Date().toISOString(),
      noticias_sites: noticiasSites,
      noticias_fixas: noticiasFixas          // ← preservadas
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(novoJSON, null, 2));
    console.log('✅  noticias.json salvo/atualizado.');

  } catch (err) {
    console.error('❌  Erro geral no scraper:', err);
    process.exit(1);
  }
})();

