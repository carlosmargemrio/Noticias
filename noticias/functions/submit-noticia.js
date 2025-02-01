// Se estiver utilizando a versão Node 14 ou superior no Netlify, o "fetch" já está disponível globalmente.
// Caso contrário, instale e importe o "node-fetch".
// Exemplo com node-fetch:
// const fetch = require("node-fetch");

exports.handler = async function(event, context) {
    // Permitimos apenas requisições POST
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Método não permitido" };
    }
  
    try {
      const body = JSON.parse(event.body);
      const { titulo, data: dataNoticia, resumo, fonte, imagem, fileName } = body;
      
      // Configure aqui os dados do seu repositório no GitHub:
      const GITHUB_USERNAME = "carlosmargemrio"; 
      const REPO = "Noticias";              
      const token = process.env.GITHUB_TOKEN;      
      
      if (!token) {
        throw new Error("Token do GitHub não configurado");
      }
      
      // URLs das APIs do GitHub
      const jsonUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO}/contents/noticias2.json`;
      const imgUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO}/contents/imagens/${fileName}`;
      
      // 1. Obter o arquivo JSON atual (notícias)
      const resJson = await fetch(jsonUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resJson.ok) {
        throw new Error("Erro ao obter o arquivo JSON");
      }
      const jsonData = await resJson.json();
      // Decodifica o conteúdo (que está em Base64)
      const decodedContent = Buffer.from(jsonData.content, 'base64').toString('utf-8');
      const noticias = JSON.parse(decodedContent);
      
      // Monta a URL da imagem (que ficará disponível no repositório)
      const imageUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO}/main/imagens/${fileName}`;
      const novaNoticia = { titulo, data: dataNoticia, resumo, imagem: imageUrl, fonte };
      noticias.noticias_escritorio.push(novaNoticia);
      
      // Codifica o novo JSON
      const novoJsonString = JSON.stringify(noticias, null, 2);
      const novoJsonBase64 = Buffer.from(novoJsonString).toString('base64');
      
      // 2. Enviar a imagem para o GitHub
      const resImg = await fetch(imgUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Nova imagem",
          content: imagem
        })
      });
      if (!resImg.ok) {
        throw new Error("Erro ao enviar a imagem");
      }
      
      // 3. Atualizar o arquivo JSON com a nova notícia
      const resUpdate = await fetch(jsonUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Nova notícia",
          content: novoJsonBase64,
          sha: jsonData.sha
        })
      });
      if (!resUpdate.ok) {
        throw new Error("Erro ao atualizar o JSON");
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Notícia enviada com sucesso!" })
      };
    } catch (error) {
      console.error("Erro na função submit-noticia:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Erro ao enviar notícia" })
      };
    }
  };
  