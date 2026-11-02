---
name: factura-pro
description: Flujo profesional de emisión y registro de facturas con desglose de IVA y totales mediante sheets_create_invoice.
---

# Factura Pro (Silvania CoreAgent)

## Descripción
Esta habilidad establece el flujo obligatorio para la generación y emisión de facturas profesionales o plantillas de factura estructuradas con cálculo automático de IVA y totales en Google Sheets.

## Cuándo Usarla
Úsala siempre que el usuario solicite:
- "Crea una factura para [cliente]"
- "Genera una factura con IVA"
- "Emite una factura de [monto/servicio]"
- "Plantilla de factura"

## Instrucciones Paso a Paso para el Agente
1. **Herramienta Obligatoria:** Si el usuario solicita una factura o plantilla de factura, es ESTRICTAMENTE OBLIGATORIO usar `sheets_create_invoice`. Está prohibido usar `sheets_create` para facturas.
2. **Parámetros:**
   - `title`: Título claro en formato `Factura_<Número/Cliente>`.
   - `number`: Número de factura correlativo si el usuario lo indica (por defecto "001").
   - `date`: Fecha de emisión si se especifica (por defecto fecha actual).
   - `locale`: "es" (España, IVA 21%) o "en" según el idioma solicitado.
3. **Cálculo y Organización:** La herramienta creará automáticamente la hoja en la carpeta canónica `silvania/` del Drive del usuario, con desglose de Base Imponible, IVA y Total.
4. **Respuesta al Usuario:**
   - Si la herramienta devuelve un error, informa al usuario claramente y no afirmes que la factura fue creada.
   - Si tiene éxito, entrega el enlace en una sola línea Markdown limpia: `[Título](URL_EDIT)`.
   - Si el usuario pide después el enlace a la factura, usa el mismo `SPREADSHEET_ID` sin llamar a `sheets_list`.

## Entregables
Hoja de cálculo en Google Sheets organizada en `silvania/` con la estructura oficial de factura profesional.

