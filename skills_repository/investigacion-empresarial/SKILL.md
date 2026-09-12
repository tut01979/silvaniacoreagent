---
name: investigacion-empresarial
description: Protocolo riguroso de investigación y prospección empresarial en tiempo real sin alucinaciones.
---

# Protocolo de Investigación Empresarial Real (Silvania CoreAgent)

## Descripción
Esta habilidad establece el protocolo operativo obligatorio para investigar empresas, negocios locales y entidades corporativas utilizando herramientas reales (`web_search` y `read_url`).

## Cuándo Usarla
Úsala siempre que el usuario solicite:
- "Investiga la empresa X"
- "Investiga con protocolo a X"
- "Busca datos de contacto, web o dirección de X"
- "Prospección o informe corporativo de X"

## Reglas Críticas Anti-Alucinación (OBLIGATORIAS)
1. **PROHIBIDO inventar URLs o datos:** Nunca crees enlaces de Google Maps (tipo `/place/...`), Páginas Amarillas, Informa o sitios web si no han sido devueltos directamente por `web_search` o leídos con `read_url`.
2. **Enlaces de Directorios:** Solo puedes usar los enlaces oficiales de búsqueda genérica con el término codificado:
   - Google Maps Search: `https://www.google.com/maps/search/<termino_codificado>`
   - Páginas Amarillas Search: `https://www.paginasamarillas.es/resultados.html?what=<termino_codificado>`
   - Informa Search: `https://www.informa.es/buscador?q=<termino_codificado>`
3. **Secciones de Verdad:** Debes separar estrictamente los datos en dos bloques:
   - **✅ DATOS VERIFICADOS (con fuente real)**
   - **⚠️ NO ENCONTRADO / PENDIENTE DE CONFIRMAR**

## Pasos de Ejecución para el Agente

### Paso 1: Búsqueda Web Inicial
- Ejecuta `web_search` con la consulta: `"<nombre_empresa> web oficial espana"` o la ubicación relevante.
- Si no hay resultados claros, haz una segunda búsqueda con `search_type: "local"` o términos adicionales de su sector.

### Paso 2: Lectura Directa de la Web Oficial
- Si localizas el dominio oficial de la empresa (o una página de contacto clave), ejecuta `read_url` sobre esa URL.
- Extrae de la web real:
  - Nombre fiscal o denominación comercial.
  - Dirección física real.
  - Teléfono(s) y correo(s) de contacto.
  - Servicios o productos principales.

### Paso 3: Elaboración del Informe Estructurado
Devuelve el informe al usuario con este formato exacto:

🏢 **INFORME EMPRESARIAL: <Nombre de la Empresa>**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ **DATOS VERIFICADOS:**
• **Sitio Web Oficial:** [Enlace real devuelto por la tool] (o "No encontrado")
• **Razón Social / CIF:** [Dato extraído] (o "No disponible en web pública")
• **Dirección / Sede:** [Dirección extraída] (o "No especificada")
• **Teléfono de Contacto:** [Teléfono real extraído]
• **Email de Contacto:** [Email real extraído]
• **Actividad Principal:** [Resumen fiel de lo que ofrece]

⚠️ **NO ENCONTRADO / POR CONFIRMAR:**
• [Detallar qué datos no pudieron ser contrastados fehacientemente]

🔗 **ENLACES DE BÚSQUEDA ADICIONALES (Directorio):**
• 📍 **Google Maps:** https://www.google.com/maps/search/<nombre_codificado>
• 📒 **Páginas Amarillas:** https://www.paginasamarillas.es/resultados.html?what=<nombre_codificado>
• 🏢 **Informa:** https://www.informa.es/buscador?q=<nombre_codificado>
• 💼 **LinkedIn:** https://www.linkedin.com/search/results/all/?keywords=<nombre_codificado>
