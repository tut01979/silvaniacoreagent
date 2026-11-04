---
name: investigacion-empresarial
description: Protocolo riguroso de investigación corporativa y prospección en tiempo real usando web_search y read_url sin URLs inventadas, con redes sociales y enlaces adicionales verificados.
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

## Reglas Críticas Anti-Alucinación y de Transparencia (OBLIGATORIAS)
1. **PROHIBIDO inventar URLs o datos:** Nunca crees enlaces de Google Maps (tipo `/place/...`), Páginas Amarillas, Informa o perfiles sociales si no han sido devueltos directamente por `web_search` o extraídos con `read_url`.
2. **Extracción Exhaustiva de Datos de Contacto:** Es obligatorio recopilar y listar todos los datos de contacto verificados:
   - Email(s) corporativos o de atención al cliente.
   - Teléfono(s) fijos, móviles y WhatsApp directo.
   - Dirección física, sede o polígono industrial y código postal.
   - Razón social y CIF/NIF (si es público o accesible).
   - Enlace directo a la página de contacto oficial (si existe).
3. **Redes Sociales Obligatorias:** Es obligatorio buscar, identificar y listar las redes sociales disponibles de la empresa (LinkedIn, Instagram, Facebook, Twitter/X, YouTube, etc.) con sus enlaces Markdown directos. Si no se encuentra ninguna red social oficial en la web ni en la búsqueda, debes indicar explícitamente:
   `📱 Redes sociales: No encontradas`.
4. **Enlaces y Datos Adicionales (Maps, Directorios y Solvencia):**
   - Si se localizan las fichas directas reales (localización en Google Maps, ficha en Páginas Amarillas, informe de solvencia en Informa/Registro Mercantil), deben incluirse obligatoriamente.
   - Si NO se encuentran estas fichas o datos directos, es OBLIGATORIO indicar:
     `⚠️ Enlaces adicionales no encontrados` (o detallar individualmente: `📍 Google Maps: Ficha directa no encontrada`, `📒 Páginas Amarillas: Ficha directa no encontrada`, `🏢 Solvencia / Informa: Ficha directa no encontrada`, adjuntando los enlaces de consulta de directorios correspondientes).
5. **Secciones de Verdad:** Debes estructurar el informe separando claramente:
   - **✅ DATOS CORPORATIVOS Y DE CONTACTO VERIFICADOS (con fuente real)**
   - **📱 REDES SOCIALES DISPONIBLES (o "Redes sociales no encontradas")**
   - **🚀 ENLACES Y DATOS ADICIONALES (o "Enlaces adicionales no encontrados")**
   - **⚠️ NO ENCONTRADO / PENDIENTE DE CONFIRMAR**

## Pasos de Ejecución para el Agente
1. **Búsqueda Web Inicial:** Ejecuta `web_search` con la consulta: `"<nombre_empresa> web oficial espana"` o la ubicación relevante.
2. **Lectura Directa de la Web Oficial:** Si localizas el dominio oficial de la empresa, ejecuta `read_url` sobre esa URL. Extrae razón social, CIF si figura, dirección física real, teléfono, correo electrónico y **redes sociales oficiales**.
3. **Informe Estructurado:** Devuelve el informe separando claramente los datos verificados, redes sociales encontradas (o no encontradas) y enlaces adicionales encontrados (o no encontrados).

## Entregables
Informe empresarial contrastado con fuentes reales entregado en el chat y/o guardado en Drive.

