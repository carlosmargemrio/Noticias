// scripts/scraper-iphan.js
const fs = require("fs");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const https = require("https");

const OUT = "noticias_iphan.json";
const URL = "https://www.gov.br/iphan/pt-br/assuntos/noticias";

/* ---------- scraper ---------- */
async function scrapeIphanNoticias() {
  // proxy-less: ignora certificados quebrados
  const res = await fetch(URL, {
    agent: new https.Agent({ rejectUnauthorized: false }),
    headers: { "user-agent": "Mozilla/5.0 (GitHub-Actions)" }
  });
  const html = await res.text();
  const { window } = new JSDOM(html);
  const doc = window.document;

  // pega só 3 <li> dentro da lista principal
  const itens = Array
    .from(doc.querySelectorAll("ul.noticias.listagem-noticias-com-foto li"))
    .slice(0, 3);

  const noticias = itens.map(li => {
    const titulo = li.querySelector("h2.titulo a")?.textContent.trim() || "";
    const link   = li.querySelector("h2.titulo a")?.href               || "";
    const data   = li.querySelector("span.data")?.textContent.trim()   || "";

    // span.descricao = data + “ - ” + resumo  → removemos o prefixo
    let resumo = li.querySelector("span.descricao")?.textContent.trim() || "";
    resumo = resumo.replace(data, "").replace(/^[-–]\s*/, "").trim();

    const imagem = (li.querySelector("img")?.src || "").replace("/mini", "");

    return { titulo, data, resumo, imagem, link };
  });

  const novoJson = {
    atualizado_em: new Date().toISOString(),
    noticias_iphan: noticias
  };

  /* ---------- salva só se mudou ---------- */
  if (fs.existsSync(OUT)) {
    const anterior = JSON.parse(fs.readFileSync(OUT, "utf8"));
    const strip = o => JSON.stringify(o.noticias_iphan);
    if (strip(anterior) === strip(novoJson)) {
      console.log("🔁 Nenhuma mudança nas notícias – nada a salvar.");
      return;
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(novoJson, null, 2));
  console.log("✅ noticias_iphan.json atualizado.");
}

/* run */
scrapeIphanNoticias().catch(err => {
  console.error("❌ Erro ao scrapear IPHAN:", err);
  process.exit(1);
});
