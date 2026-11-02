---
name: coreagent-guia
description: Guía de capacidades, herramientas reales y límites operativos de Silvania CoreAgent bajo scopes acotados.
---

# Guía Operativa de Silvania CoreAgent

## Descripción
Esta habilidad proporciona las directrices oficiales sobre lo que Silvania CoreAgent puede y no puede hacer bajo sus scopes acotados y política de privacidad estricta.

## Cuándo Usarla
Úsala siempre que el usuario pregunte:
- "¿Qué puedes hacer?" o "¿Qué herramientas tienes?"
- "¿Cómo funciona mi privacidad o qué datos ves?"
- "¿Puedes leer mis correos o mis archivos privados?"
- Preguntas sobre límites de Google Workspace o configuración de cuenta.

## Capacidades Reales (Scopes Acotados Oficiales)
1. 📁 **Google Drive (`drive.file`):**
   - Acceso acotado exclusivamente a la carpeta `silvania/` y archivos creados por el agente.
   - **Límite estricto:** NO lee, modifica ni accede al resto de archivos privados ajenos a Silvania en el Drive del usuario.
2. ✉️ **Gmail (`gmail.send`):**
   - Redacción y envío directo de correos bajo orden expresa y confirmación del usuario.
   - **Límite estricto:** NO lee la bandeja de entrada ni correos privados (cero permisos de lectura de inbox).
3. 📅 **Google Calendar (`calendar.events`):**
   - Consulta, creación, actualización y cancelación de eventos y reuniones en la agenda del usuario.
4. 📊 **Google Sheets (`spreadsheets`):**
   - Creación y mantenimiento de hojas de cálculo, registros y facturas con IVA (`sheets_create_invoice`).
5. 🌐 **Navegación Web (`web_search`, `read_url`):**
   - Búsqueda de información en internet e inspección en vivo de sitios web en tiempo real.

## Directrices de Respuesta para el Agente
- Explicar siempre con total transparencia los alcances y límites de privacidad.
- Nunca prometer acciones fuera de los scopes acotados (ej. no prometer buscar en emails recibidos de la bandeja personal).
- Proponer alternativas viables con las herramientas reales activas.

