/* eslint-disable no-console */
const fs    = require('fs');
const path  = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const AbortController = require('abort-controller');

const URL           = 'https://www.gov.br/iphan/pt-br/assuntos/noticias';
const JSON_FILE     = path.join(__dirname, '..', 'noticias_iphan.json');
const MAX_NOTICIAS  = 3;
const TIMEOUT_MS    = 30_000;   // 30 s
const MAX_TENTATIVAS = 3;

/* -------------------------------------------------------------------------- */
/* util: tenta baixar com timeout + retries                                   */
/* -------------------------------------------------------------------------- */
async function fetchWithRetry(url, tentativas = MAX_TENTATIVAS) {
  for (let i = 1; i <= tentativas; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (GitHubActions scraper)' }
      });
      clearTimeout(id);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();                // 👍  sucesso
    } catch (err) {
      clearTimeout(id);
      console.warn(`⚠️  tentativa ${i}/${tentativas} falhou: ${err.message}`);
      if (i === tentativas) throw err;        // esgotou tentativas
      await new Promise(r => setTimeout(r, 3_000)); // pequena espera
    }
  }
}

/* -------------------------------------------------------------------------- */
(async () => {
  try {
    console.log('🔎  Buscando página do IPHAN…');
    const html = await fetchWithRetry(URL);

    /* ---- parse DOM -------------------------------------------------------- */
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const itens = Array.from(
      doc.querySelectorAll('li > .conteudo')
    ).slice(0, MAX_NOTICIAS);

    const noticias = itens.map(div => {
      const tituloEl = div.querySelector('h2.titulo a');
      const dataEl   = div.querySelector('.descricao .data');
      const descEl   = div.querySelector('.descricao');
      const imgEl    = div.parentElement.querySelector('img.newsImage');

      return {
        titulo : tituloEl?.textContent.trim()      || '',
        data   : dataEl?.textContent.trim()        || '',
        resumo : (descEl?.textContent || '')
                   .replace(/\s+/g, ' ')
                   .replace(dataEl?.textContent || '', '')
                   .replace(/^ - /, '')
                   .trim(),
        imagem : (imgEl?.src || '').replace('/mini', ''),
        link   : tituloEl?.href || ''
      };
    });

    const novoJson = {
      atualizado_em : new Date().toISOString(),
      noticias_iphan: noticias
    };

    /* ---- compara com arquivo anterior ------------------------------------ */
    if (fs.existsSync(JSON_FILE)) {
      const anterior = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
      const strip = o => JSON.stringify(o.noticias_iphan);
      if (strip(anterior) === strip(novoJson)) {
        console.log('🔁  Nenhuma mudança detectada.');
        process.exit(0);
      }
    }

    fs.writeFileSync(JSON_FILE, JSON.stringify(novoJson, null, 2));
    console.log('✅  Arquivo atualizado.');
  } catch (err) {
    // Falhou todas as tentativas → apenas loga e sai “sucesso” para
    // evitar marcar o workflow como failed (não há o que commitar)
    console.error('❌  IPHAN indisponível:', err.message);
    process.exit(0);
  }
})();
