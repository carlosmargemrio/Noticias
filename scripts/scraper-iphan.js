const fs = require('fs');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const path = 'noticias_iphan.json';

async function scrapeIphanNoticias() {
  const URL = 'https://www.gov.br/iphan/pt-br/assuntos/noticias';
  try {
    const res = await fetch(URL);
    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const items = Array.from(doc.querySelectorAll("li")).slice(0, 3);
    const noticias = items.map(li => {
      const titulo = li.querySelector("h2.titulo a")?.textContent.trim() || "";
      const link = li.querySelector("h2.titulo a")?.href || "";
      const data = li.querySelector(".descricao .data")?.textContent.trim() || "";
      const resumo = li.querySelector(".descricao")?.textContent.trim().replace(/\s+/g, " ") || "";
      const imagem = li.querySelector("img")?.src?.replace("/mini", "") || "";
      return { titulo, data, resumo, imagem, link };
    });

    const novoJson = {
      atualizado_em: new Date().toISOString(),
      noticias_iphan: noticias
    };

    if (fs.existsSync(path)) {
      const anterior = JSON.parse(fs.readFileSync(path, 'utf8'));
      const semAtualizado = (obj) => JSON.stringify({ noticias_iphan: obj.noticias_iphan });
      if (semAtualizado(anterior) === semAtualizado(novoJson)) {
        console.log("🔁 Nenhuma mudança nas notícias. Nada a fazer.");
        return;
      }
    }

    fs.writeFileSync(path, JSON.stringify(novoJson, null, 2));
    console.log("✅ Notícias IPHAN atualizadas.");
  } catch (error) {
    console.error("❌ Erro ao scrapear IPHAN:", error);
    process.exit(1);
  }
}

scrapeIphanNoticias();
