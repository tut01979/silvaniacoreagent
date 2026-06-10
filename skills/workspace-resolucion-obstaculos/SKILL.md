---
name: workspace-resolucion-obstaculos
description: Habilidad para resolver obstáculos comunes en Gmail, Drive y Calendar (listar enviados, enlaces directos, mover archivos y modificar eventos).
---

# Resolución de Obstáculos Comunes en Google Workspace

Esta habilidad le proporciona al agente el conocimiento y patrones exactos para resolver problemas de navegación, visualización y gestión en Gmail, Drive y Calendar.

## 1. Listar y Buscar Correos Enviados (Gmail)
* **Obstáculo:** `gmail_list` solo recupera correos de la bandeja de entrada (Inbox).
* **Resolución:** Utilizar la herramienta `gmail_search` con la consulta `in:sent` o `from:me in:sent` para recuperar los correos enviados por el usuario.
* **Ejemplo:**
  * Para ver los últimos 5 correos enviados: `gmail_search({ query: "in:sent", max_results: 5 })`

## 2. Enlaces Directos a Correos Enviados
* **Obstáculo:** Confirmar al usuario que un correo ha sido enviado con éxito y darle acceso inmediato.
* **Resolución:** Cuando se ejecuta `gmail_send`, la API retorna un objeto que incluye el ID del mensaje/hilo. Utiliza este ID para construir un enlace directo a Gmail en el navegador:
  * URL: `https://mail.google.com/mail/u/0/#inbox/<ID_DEL_MENSAJE>`

## 3. Organización y Movimiento de Archivos (Drive)
* **Obstáculo:** Mover archivos o fotos a subcarpetas específicas sin errores de sintaxis o de ruta.
* **Resolución:**
  1. Identificar o crear la carpeta de destino usando `drive_mkdir` o buscando su ID con `drive_search`.
  2. Utilizar `drive_move` especificando de manera explícita `file_id` (el ID del archivo que se desea mover) y `parent_id` (el ID de la carpeta de destino).
  * **Ejemplo:** `drive_move({ file_id: "1kqA9EAR...", parent_id: "11Kj0AK..." })`

## 4. Modificación y Actualización de Eventos (Calendario)
* **Obstáculo:** No hay una herramienta directa de TypeScript expuesta para actualizar eventos.
* **Resolución:** Utilizar la herramienta flexible `google_workspace` ejecutando el comando del CLI `gog` para actualizar campos específicos del evento por su ID:
  * Comando: `calendar update primary <eventId> --summary "Nuevo Título" --from "ISO-START" --to "ISO-END"`
  * *Nota:* Asegúrate de pasar las fechas en formato ISO con la zona horaria/offset correcta (ej: `2026-06-13T11:30:00+02:00`).

## 5. Paginación en Listados de Drive Grandes
* **Obstáculo:** Encontrar archivos en un Drive con cientos de elementos.
* **Resolución:** Usar `drive_list` con `all=true` y avanzar páginas utilizando el parámetro `page` (página 0, 1, 2...) o usar la habilidad especializada `drive-list-large`.
