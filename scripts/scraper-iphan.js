/* eslint-disable no-console */
const fs   = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const URL          = 'https://www.gov.br/iphan/pt-br/assuntos/noticias';
const JSON_FILE    = path.join(__dirname, '..', 'noticias_iphan.json');
const MAX_NOTICIAS = 3;

(async function scrapeIphan() {
  try {
    // --- faz download do HTML -------------------------------------------------
    console.log('🔎  Buscando página do IPHAN…');
    const res  = await fetch(URL, { timeout: 15_000 });
    const html = await res.text();

    // --- parse DOM ------------------------------------------------------------
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const items = Array.from(
      doc.querySelectorAll('li .conteudo')   // pega somente o bloco <div class="conteudo">
    ).slice(0, MAX_NOTICIAS);

    const noticias = items.map(div => {
      const tituloEl = div.querySelector('h2.titulo a');
      const dataEl   = div.querySelector('.descricao .data');
      const descEl   = div.querySelector('.descricao');
      const imgEl    = div.parentElement.querySelector('img.newsImage'); // fora do .conteudo

      return {
        titulo : tituloEl?.textContent.trim()         || '',
        data   : dataEl?.textContent.trim()           || '',
        resumo : (descEl?.textContent || '')
                   .replace(/\s+/g, ' ')
                   .replace(dataEl?.textContent || '', '')
                   .replace(/^ - /, '')
                   .trim(),
        imagem : (imgEl?.src || '').replace('/mini', ''),
        link   : tituloEl?.href                      || ''
      };
    });

    // --- monta objeto final ---------------------------------------------------
    const novoJson = {
      atualizado_em : new Date().toISOString(),
      noticias_iphan: noticias
    };

    // --- se o arquivo existir, compara conteúdo ------------------------------
    if (fs.existsSync(JSON_FILE)) {
      const anterior = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
      const strip = obj => JSON.stringify(obj.noticias_iphan);

      if (strip(anterior) === strip(novoJson)) {
        console.log('🔁  Nenhuma mudança. Arquivo permanece igual.');
        process.exit(0);           // encerra sem erro; Action não fará commit
      }
    }

    // --- grava arquivo --------------------------------------------------------
    fs.writeFileSync(JSON_FILE, JSON.stringify(novoJson, null, 2));
    console.log('✅  Notícias IPHAN atualizadas em', JSON_FILE);
  } catch (err) {
    console.error('❌  Erro ao scrapear IPHAN:', err.message);
    process.exit(1);               // força falha na Action
  }
})();
