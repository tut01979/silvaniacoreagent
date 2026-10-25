---
name: taller-mecanica-flujo
description: Flujo integral para talleres mecánicos con recepción de vehículos, diagnósticos, presupuestos y partes de trabajo sobre el libro canónico Taller_Partes en Google Sheets y Google Drive.
---

# Flujo Integral de Taller Mecánico — Partes de Trabajo (Silvania CoreAgent)

## Descripción
Esta habilidad establece el flujo operativo oficial para la gestión de partes de trabajo, presupuestos y seguimiento de reparaciones en talleres mecánicos dentro del ecosistema Silvania CoreAgent.

## Principio Fundamental: Un Libro Canónico Único (`Taller_Partes`)
1. **PROHIBIDO DUPLICAR LIBROS:** En un taller mecánico existe **un único libro central de partes** denominado exactamente `Taller_Partes`, alojado dentro de la carpeta canónica `silvania/` en Google Drive.
2. **Reutilización y Append:** 
   - Nunca crees libros adicionales para cada vehículo o día.
   - Para registrar un nuevo parte, se utiliza siempre `sheets_append` (o `sheets_write` a la fila correspondiente) añadiendo una nueva fila al final del libro existente.
   - Si no se conoce el `spreadsheetId`, llama a `sheets_create` con `title: "Taller_Partes"`; el sistema detectará el libro existente y devolverá su ID y enlace canónico sin crear duplicados.

## Estructura Oficial de Columnas (15 Campos Exactos)
El libro canónico `Taller_Partes` cuenta con diseño profesional corporativo Silvania:
- **Fila 1 (Título corporativo):** `PARTES DE TALLER — Silvania` (Fondo azul marino `#1a365d`, texto blanco negrita, centrado).
- **Fila 2 (Cabeceras congeladas):**
  1. `ID`: Identificador correlativo del parte (ej. `PARTE-001`, `PARTE-002`).
  2. `Fecha`: Fecha de recepción (YYYY-MM-DD o DD/MM/YYYY).
  3. `Cliente`: Nombre completo del cliente o empresa.
  4. `Teléfono`: Teléfono de contacto (formato texto).
  5. `Matrícula`: Matrícula del vehículo en mayúsculas (formato texto).
  6. `Marca/Modelo`: Marca y modelo comercial (ej. `Seat León 1.6 TDI`).
  7. `Km`: Kilometraje actual del vehículo (número).
  8. `Avería`: Descripción de la avería o síntomas reportados por el cliente.
  9. `Diagnóstico`: Diagnóstico técnico y trabajos a realizar.
  10. `Presupuesto_neto`: Importe de mano de obra y recambios sin IVA (número con 2 decimales).
  11. `IVA`: Importe del IVA (21% o fórmula `=J3*0,21`).
  12. `Total`: Importe total con IVA (fórmula `=J3+K3` o número calculado).
  13. `Estado`: Estado del trabajo (`Pendiente`, `En reparación`, `Esperando piezas`, `Terminado`, `Entregado`).
  14. `Notas`: Observaciones técnicas, piezas sustituidas o advertencias.
  15. `Link_fotos`: Enlace a la carpeta de fotos/documentación en Google Drive (o vacío).

## Procedimiento Paso a Paso

### Paso 1: Localización del Libro Canónico
- Ejecuta `sheets_create` con `title: "Taller_Partes"`.
- Si el libro ya existía, la herramienta responderá indicando el `spreadsheetId` canónico y el enlace directo.
- Si no existía, el sistema lo creará con el formato profesional corporativo y devolverá su nuevo `spreadsheetId`.

### Paso 2: Creación Opcional de Carpeta de Fotos (Google Drive)
- Si el parte incluye fotos o documentación del vehículo:
  - Ejecuta `drive_mkdir` con el nombre de la carpeta (ej. `Parte_<Matricula>_<Fecha>`).
  - **REGLA ESTRICTA ANTI-ALUCINACIÓN:** Si `drive_mkdir` o `drive_search` **NO devuelve un `id` real de carpeta**, está TERMINANTEMENTE PROHIBIDO inventar un ID o URL falsa de Google Drive. En ese caso, deja la columna `Link_fotos` vacía o como `"No asignado"` e informa con honestidad al usuario.
  - Si la herramienta devuelve un `id` real de carpeta, construye el enlace: `https://drive.google.com/drive/folders/<id>`.

### Paso 3: Inserción de la Fila (Append)
- Llama a `sheets_append` con:
  - `spreadsheet_id`: El ID real del libro `Taller_Partes`.
  - `range`: `"A:O"`
  - `values`: Matriz con los 15 valores en el orden exacto de cabeceras.

### Paso 4: Respuesta al Usuario con Enlace Obligatorio Real
- Informa al usuario con un resumen claro del parte registrado (ID, Cliente, Matrícula, Vehículo, Avería y Presupuesto).
- **ENLACE OBLIGATORIO:** Incluye SIEMPRE el enlace Markdown completo al documento:
  `📊 **Documento:** [Abrir en Google Sheets](https://docs.google.com/spreadsheets/d/<spreadsheetId>/edit)`
- **PROHIBICIÓN:** Está terminantemente prohibido emitir la frase "Abrir en Google Sheets" o "Abrir" sin el hipervínculo completo con el `spreadsheetId` real. Nunca uses URLs genéricas como `https://docs.google.com/spreadsheets/`.
