---
name: sheets-plantillas-pro
description: Plantillas profesionales y escritura batch atómica en Google Sheets para facturas con IVA, presupuestos, CRM/leads de prospección, inventarios y tablas genéricas.
---

# Sheets Plantillas Pro (Silvania CoreAgent)

## Cuándo Usarla
Usa esta habilidad siempre que el usuario solicite crear o rellenar en Google Sheets:
- **Factura** o plantilla de factura con IVA (`es-ES` o `en`).
- **Presupuesto / Proforma / Cotización**.
- **CRM / Prospección / Leads / Contactos** (incluyendo resultados de búsqueda web).
- **Inventario simple** o cualquier **tabla genérica** definida por el usuario.

## Flujo Atómico Obligatorio
1. **Crear la hoja correcta:**
   - Si es **factura con IVA**, llama a `sheets_create_invoice` (crea, formatea y escribe fórmulas).
   - Si es **presupuesto / proforma**, llama a `sheets_create_budget`.
   - Para **CRM/leads, inventario o tabla genérica**, llama a `sheets_create` con un título descriptivo (el sistema la guarda automáticamente en la carpeta canónica `silvania/`).
2. **UNA sola escritura BATCH (`sheets_write`):**
   - Pasa `values` como matriz 2D `any[][]` completa desde `"A1"` (`[cabeceras, ...filas]`) en una **única** llamada a `sheets_write`.
   - **PROHIBIDO** escribir celda a celda o hacer `>= 3` llamadas a `sheets_write` sobre el mismo `spreadsheet_id`.
3. **Devolver enlace real en Markdown clicable:**
   - Usa únicamente el `spreadsheetId` y la URL real devueltos por la herramienta:
     `[Título de la hoja](https://docs.google.com/spreadsheets/d/<spreadsheetId>/edit)`
   - Prohibido inventar IDs o devolver la URL genérica `https://docs.google.com/spreadsheets/`.

---

## Plantilla 1: FACTURA (`es-ES` con fallback `en`)
- Preferente: `sheets_create_invoice`.
- Si se construye matriz manual con `sheets_create` + `1× sheets_write`:
  - Cabeceras de líneas: `Concepto | Cantidad | Precio Unitario | Importe`
  - Fórmulas por fila `x`: `=Bx*Cx`
  - Subtotal: `=SUMA(Dstart:Dend)` (fallback inglés: `=SUM(Dstart:Dend)`)
  - IVA 21%: `=Dsub*0,21` (fallback inglés: `=Dsub*0.21`)
  - TOTAL: `=Dsub+Diva`

## Plantilla 2: PRESUPUESTO / PROFORMA
- Preferente: `sheets_create_budget`.
- Incluye datos de empresa/cliente, fecha (`=HOY()`), **Válido hasta** / notas de validez, tabla de partidas con fórmulas de importe (`=Bx*Cx`), `=SUMA(...)`, IVA (si aplica) y Total.

## Plantilla 3: CRM / PROSPECCIÓN / CONTACTOS
Cabeceras exactas (fila 1):
`Nombre | Empresa | Web | Teléfono | Email | WhatsApp | Dirección | Ciudad | Instagram | Facebook | LinkedIn | Estado | Notas | Fuente | Fecha`
- `Estado` por defecto: `"Pendiente"`.
- Redes y WhatsApp solo con URL `https://` completa verificada; si no existe, `"NO ENCONTRADO"`.

## Plantilla 4: TABLA GENÉRICA / INVENTARIO
- Toma las columnas pedidas por el usuario en la fila 1, arma la matriz 2D `any[][]` completa y ejecuta **UNA sola** llamada a `sheets_write` en `"A1"`.
