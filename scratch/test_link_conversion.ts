function convertMarkdownToHtml(text: string): string {
  if (!text) return "";

  let processed = text;

  // 1. Convertir negritas Markdown a HTML (**bold** y __bold__)
  processed = processed.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  processed = processed.replace(/__([^_]+)__/g, "<b>$1</b>");

  // 2. Convertir títulos o énfasis con asterisco simple *texto* (no listas ni operaciones matemáticas)
  processed = processed.replace(/(^|[\s\n])\*([^\s*][^*]*[^\s*]|\S)\*(?=[\s\n.,:;!?]|$)/g, "$1<b>$2</b>");

  // 3. Convertir código en línea
  processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 4. Convertir enlaces Markdown [texto](url) a <a href="url">texto</a>
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, linkText, url) => {
    const safeUrl = url.replace(/"/g, "%22").replace(/&amp;/g, "&").replace(/&/g, "&amp;");
    return `<a href="${safeUrl}">${linkText}</a>`;
  });

  // 5. Proteger todas las etiquetas HTML legítimas básicas (b, i, code, pre, u, s, strike, del, span, a)
  const tokens: string[] = [];
  processed = processed.replace(/<(\/?(?:b|i|code|pre|u|s|strike|del|span|a(?:\s+href="[^"]*")?))>/gi, (match) => {
    tokens.push(match);
    return `___HTML_TOKEN_${tokens.length - 1}___`;
  });

  // 6. Escapar el resto de caracteres reservados de HTML
  processed = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 7. Restaurar las etiquetas protegidas
  processed = processed.replace(/___HTML_TOKEN_(\d+)___/g, (_, idx) => {
    return tokens[parseInt(idx, 10)];
  });

  return processed;
}

const input = `
📰 *Radar del día*

*Economía*
• Subida tipos BCE — Afecta a hipotecas y empresas [Europa Press](https://www.europapress.es/economia/noticia.html?id=123&sec=eco)

*IA*
• GPT-5 anunciado — Nuevo modelo [TechCrunch](https://techcrunch.com/ai?ref=silvania)

📄 Archivo existente · 🔗 Abrir (https://drive.google.com/file/d/123/view?usp=drivesdk&key=abc)
Nota: El coste es < de 100€ y el margen es > 0%.
`;

console.log("=== ENTRADA ===");
console.log(input);

const output = convertMarkdownToHtml(input);
console.log("=== SALIDA HTML ===");
console.log(output);

// Verificaciones
console.log("\n=== VERIFICACIONES ===");
console.log("1. Contiene <b>Radar del día</b>:", output.includes("<b>Radar del día</b>"));
console.log("2. Contiene <b>Economía</b>:", output.includes("<b>Economía</b>"));
console.log("3. Enlace Europa Press con &amp;:", output.includes('<a href="https://www.europapress.es/economia/noticia.html?id=123&amp;sec=eco">Europa Press</a>'));
console.log("4. Enlace TechCrunch:", output.includes('<a href="https://techcrunch.com/ai?ref=silvania">TechCrunch</a>'));
console.log("5. Bare link preservado:", output.includes("(https://drive.google.com/file/d/123/view?usp=drivesdk&amp;key=abc)"));
console.log("6. < y > escapados:", output.includes("&lt; de 100€ y el margen es &gt; 0%"));
