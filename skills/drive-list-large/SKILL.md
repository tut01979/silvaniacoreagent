---
name: drive-list-large
description: Lista archivos y carpetas de Google Drive, manejando grandes cantidades de datos de forma paginada o resumida.
---

# Habilidad para Listar Grandes Cantidades de Archivos en Google Drive

## Cuándo Usar Esta Habilidad

Esta habilidad se activa cuando el usuario solicita listar todos los archivos y carpetas en Google Drive, y la cantidad de elementos es demasiado grande para mostrar en una sola respuesta.

## Instrucciones

1.  Utilizar la función `drive_list(all=True)` para obtener la lista completa de archivos y carpetas.
2.  Si la cantidad de elementos es mayor a un límite (ej: 20), ofrecer opciones para mostrar la información de forma paginada o resumida.
3.  **Opción Paginada:** Mostrar los elementos en páginas de 20 en 20, permitiendo al usuario navegar entre las páginas.
4.  **Opción Resumida:** Mostrar un resumen de la cantidad de archivos y carpetas, y permitir al usuario filtrar por tipo o nombre.
5.  Implementar funciones para navegar entre las páginas y filtrar los resultados.

## Herramientas Disponibles

*   `drive_list(all=True)`
*   Funciones para paginar y filtrar los resultados.

## Ejemplos

*   Usuario: "Lista todos los archivos en mi Drive"
*   Agente: "Hay demasiados archivos para mostrar en una sola respuesta. ¿Quieres ver la lista de forma paginada o resumida?"
*   Usuario: "Paginada"
*   Agente: "Mostrando la página 1 de 20..."

*   Usuario: "Lista todos los archivos en mi Drive"
*   Agente: "Hay demasiados archivos para mostrar en una sola respuesta. ¿Quieres ver la lista de forma paginada o resumida?"
*   Usuario: "Resumida"
*   Agente: "Hay 450 archivos y 50 carpetas en tu Drive. ¿Quieres filtrar por tipo o nombre?"
