---
name: investigacion-empresarial
description: Protocolo riguroso de investigación corporativa y prospección en tiempo real usando web_search y read_url sin URLs inventadas.
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
1. **Búsqueda Web Inicial:** Ejecuta `web_search` con la consulta: `"<nombre_empresa> web oficial espana"` o la ubicación relevante.
2. **Lectura Directa de la Web Oficial:** Si localizas el dominio oficial de la empresa, ejecuta `read_url` sobre esa URL. Extrae razón social, CIF si figura, dirección física real, teléfono y correo electrónico.
3. **Informe Estructurado:** Devuelve el informe separando claramente los datos verificados de los no encontrados.

## Entregables
Informe empresarial contrastado con fuentes reales entregado en el chat y/o guardado en Drive.

