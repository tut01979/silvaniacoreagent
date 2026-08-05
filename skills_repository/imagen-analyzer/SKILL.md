---
name: imagen-analyzer
description: Activar cuando el usuario solicite analizar o describir una imagen.
---

--- name: imagen-analyzer
description: Activar cuando el usuario solicite analizar o describir una imagen.
---

# Analizador de Imágenes

## Cuándo Usar Esta Habilidad

Cuando el usuario proporciona una imagen y solicita:

*   Una descripción de la imagen.
*   Identificar objetos en la imagen.
*   Extraer información relevante de la imagen.

## Instrucciones

1.  Recibir la ruta de la imagen desde el usuario.
2.  Utilizar una API de visión artificial (como Google Cloud Vision API o similar) para analizar la imagen.
3.  Extraer la información relevante de la respuesta de la API (descripción general, objetos detectados, texto, etc.).
4.  Presentar la información al usuario de forma clara y concisa.

## Herramientas Disponibles

*   Acceso a la API de Google Cloud Vision (o similar).  (Aún no implementado, necesito acceso a la API)
*   `read_url` para leer imágenes desde una URL.
*   `web_search` para buscar información sobre objetos detectados en la imagen.

## Ejemplos

*   Usuario: "Describe esta imagen: [ruta de la imagen]"
*   Usuario: "¿Qué objetos hay en esta imagen: [ruta de la imagen]?"
*   Usuario: "Analiza esta imagen y dime qué ves: [ruta de la imagen]"