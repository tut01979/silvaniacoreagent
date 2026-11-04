---
name: investigacion-empresarial
description: Protocolo riguroso de investigación corporativa, análisis empresarial y prospección en tiempo real usando web_search y read_url sin URLs inventadas, con análisis de actividad, resumen de web, contactos, redes sociales y enlaces adicionales verificados.
---

# Protocolo de Investigación Empresarial Real (Silvania CoreAgent)

## Descripción
Esta habilidad establece el protocolo operativo obligatorio para investigar empresas, negocios locales y entidades corporativas utilizando herramientas reales (`web_search` y `read_url`).

## Cuándo Usarla
Úsala siempre que el usuario solicite:
- "Investiga la empresa X" o "Investiga X.com / X.ai"
- "Investiga con protocolo a X"
- "A qué se dedica X, qué servicios ofrece o resumen de su web"
- "Busca datos de contacto, web o dirección de X"
- "Prospección o informe corporativo de X"

## Reglas Críticas Anti-Alucinación y de Transparencia (OBLIGATORIAS)
1. **Detección de Dominio en Consulta:** Si el usuario escribe un dominio (ej: "Silvania.ai", "mercadona.es") o una URL directa, DEBES llamar prioritariamente a `read_url` sobre ese dominio oficial ("https://silvania.ai") para inspeccionar su sitio web real.
2. **Análisis y Resumen Empresarial Obligatorio:** Toda investigación debe explicar con claridad:
   - A qué se dedica la empresa y cuál es su actividad principal o sector.
   - Qué productos, catálogo o servicios ofrece.
   - Su modelo de negocio, público objetivo o propuesta de valor según lo publicado en su web oficial.
3. **PROHIBIDO inventar URLs o datos:** Nunca crees enlaces de Google Maps (tipo `/place/...`), Páginas Amarillas, Informa o perfiles sociales si no han sido devueltos directamente por `web_search` o extraídos con `read_url`.
4. **Extracción Exhaustiva de Datos de Contacto:** Es obligatorio recopilar y listar todos los datos de contacto verificados:
   - Email(s) corporativos o de atención al cliente.
   - Teléfono(s) fijos, móviles y WhatsApp directo.
   - Dirección física, sede corporativa o polígono industrial y código postal.
   - Razón social y CIF/NIF (si es público o figura en el aviso legal).
   - Enlace directo a la página de contacto oficial (si existe).
5. **Redes Sociales Obligatorias:** Es obligatorio buscar, identificar y listar las redes sociales disponibles de la empresa (LinkedIn, Instagram, Facebook, Twitter/X, YouTube, etc.) con sus enlaces Markdown directos. Si no se encuentra ninguna red social oficial en la web ni en la búsqueda, debes indicar explícitamente:
   `📱 Redes sociales: No encontradas`.
6. **Enlaces y Datos Adicionales (Maps, Directorios y Solvencia):**
   - Si se localizan las fichas directas reales (localización en Google Maps, ficha en Páginas Amarillas, informe de solvencia en Informa/Registro Mercantil), deben incluirse obligatoriamente.
   - Si NO se encuentran estas fichas o datos directos, es OBLIGATORIO indicar:
     `⚠️ Enlaces adicionales no encontrados` (o detallar individualmente: `📍 Google Maps: Ficha directa no encontrada`, `📒 Páginas Amarillas: Ficha directa no encontrada`, `🏢 Solvencia / Informa: Ficha directa no encontrada`, adjuntando los enlaces de consulta de directorios correspondientes).
7. **Estructura Obligatoria del Informe:** Debes estructurar el informe separando claramente:
   - **🏢 ANÁLISIS Y RESUMEN EMPRESARIAL (Web Oficial)**
   - **✅ DATOS CORPORATIVOS Y DE CONTACTO VERIFICADOS**
   - **📱 REDES SOCIALES DISPONIBLES (o "Redes sociales no encontradas")**
   - **🚀 ENLACES Y DIRECTORIOS ADICIONALES (o "Enlaces adicionales no encontrados")**
   - **⚠️ NO ENCONTRADO / PENDIENTE DE CONFIRMAR**

## Pasos de Ejecución para el Agente
1. **Detección Directa o Búsqueda:** Si el usuario aporta un dominio o URL (ej: "Silvania.ai"), llama a `read_url` sobre él directamente. Si aporta solo un nombre comercial (ej: "Mercadona"), ejecuta `web_search`.
2. **Lectura Obligatoria de la Web Oficial:** En cuanto localices el dominio oficial de la empresa, ejecuta `read_url` sobre esa URL. Extrae actividad principal, servicios, razón social, CIF si figura, dirección física real, teléfono, correo electrónico y **redes sociales oficiales**.
3. **Informe Estructurado:** Devuelve el informe con las secciones requeridas.

## Entregables
Informe empresarial contrastado con fuentes reales entregado en el chat y/o guardado en Drive.
