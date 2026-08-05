---
name: workspace-resolucion-obstaculos
description: Habilidad para resolver obstáculos comunes en Gmail, Drive y Calendar (listar enviados, enlaces directos, mover archivos y modificar eventos).
---

# Resolución de Obstáculos Comunes en Google Workspace

Esta habilidad le proporciona al agente el conocimiento y patrones exactos para resolver problemas de navegación, visualización y gestión en Gmail, Drive y Calendar.

## 1. Listar y Buscar Correos Recibidos y Enviados (Gmail)
* **Obstáculo:** `gmail_list` a veces recupera correos mezclados con enviados (`SENT`) o correos secundarios de promociones y notificaciones en lugar de los principales ordenados cronológicamente.
* **Resolución:** 
  - La herramienta `gmail_list` está configurada por defecto para listar los correos del buzón principal mediante la consulta: `in:inbox -category:promotions -category:social -category:updates -category:forums -label:SENT`.
  - Si necesitas realizar una búsqueda más amplia, utiliza `gmail_search` especificando la consulta (query) adaptada a lo que pide el usuario.
  - Para listar correos enviados por el usuario, utiliza `gmail_search` con la consulta `in:sent` o `from:me in:sent`.
  * **Ejemplo:**
    * Para ver los últimos 5 correos enviados: `gmail_search({ query: "in:sent", max_results: 5 })`

## 2. Enlaces Directos a Correos Enviados
* **Obstáculo:** Confirmar al usuario que un correo ha sido enviado con éxito y darle acceso inmediato.
* **Resolución:** Cuando se ejecuta `gmail_send` o se listan correos, la API retorna el ID del mensaje. Utiliza este ID para construir un enlace directo a Gmail en el navegador:
  * URL: `https://mail.google.com/mail/u/0/#inbox/<ID_DEL_MENSAJE>`

## 3. Organización y Movimiento de Archivos (Drive)
* **Obstáculo:** Mover archivos o fotos a subcarpetas específicas sin errores de sintaxis o de ruta.
* **Resolución:**
  1. Identificar o crear la carpeta de destino usando `drive_mkdir` o buscando su ID con `drive_search`.
  2. Utilizar `drive_move` especificando de manera explícita `file_id` (el ID del archivo que se desea mover) y `parent_id` (el ID de la carpeta de destino).
  * **Ejemplo:** `drive_move({ file_id: "1kqA9EAR...", parent_id: "11Kj0AK..." })`

## 4. Modificación, Actualización y Eliminación de Eventos (Calendario)
* **Obstáculo:** Anteriormente se requería usar el CLI de `gog` para modificar eventos, lo que generaba problemas interactivos y bloqueos en Windows.
* **Resolución:** 
  - Utilizar la herramienta dedicada `calendar_update` indicando el `event_id` y los campos que deseas modificar de manera estructurada:
    * Parámetros: `calendar_update({ event_id: "id", summary: "Nuevo Título", start: "ISO-START", end: "ISO-END", description: "Opcional" })`
  - Utilizar la herramienta `calendar_delete` con `event_id` para eliminar eventos. Estas llamadas configuran automáticamente `sendUpdates: "none"` en segundo plano para evitar el envío de notificaciones cruzadas por correo a otros usuarios del calendario.

## 5. Paginación en Listados de Drive Grandes
* **Obstáculo:** Encontrar archivos en un Drive con cientos de elementos.
* **Resolución:** Usar `drive_list` con `all=true` y avanzar páginas utilizando el parámetro `page` (página 0, 1, 2...) o usar la habilidad especializada `drive-list-large`.
