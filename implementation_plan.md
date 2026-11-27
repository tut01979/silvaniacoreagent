# Plan de Implementación P0: Prospección Web Fiable, Google Sheets Pro y Coherencia de Cuenta Google

## Principios y Preservación Obligatoria
- **6 Reglas Absolutas de Silvania:** Cero eliminaciones de herramientas, skills en `silvania/skills/`, carpeta canónica `silvania/`, OAuth dual (`prod` vs `beta`), Eva, Marketing Studio, crons o `Taller_Partes`.
- **Formato de enlaces en Telegram:** Preservar estrictamente enlaces Markdown clicables con texto legible (`[Clínica Dental Manzanera](https://...)`, `[Instagram](https://...)`, `[WhatsApp](https://wa.me/...)`) en chat y tablas de prospección.

---

## 1. Skill `sheets-plantillas-pro` (Local + Drive canónico)
- Crear `skills/_builtin/sheets-plantillas-pro/SKILL.md` y caché local `skills/1572946817/sheets-plantillas-pro/SKILL.md`.
- Registrar en `src/services/builtinSkills.ts` (`BUILTIN_SKILL_NAMES`, `BUILTIN_SKILLS`, `getBuiltinSkillsPromptSection`).
- En `src/services/skillLoader.ts`: asegurar que si `sheets-plantillas-pro` falta en `silvania/skills/` en Drive de un usuario existente, se suba de forma aditiva sin tocar el resto de skills.
- Contenido mínimo: flujo atómico (`sheets_create` / `sheets_create_invoice` / `sheets_create_budget` + UNA `sheets_write` batch con `any[][]`), plantillas de Factura (`es-ES` con `=Bx*Cx`, `=SUMA(...)`, `=Dsub*0,21`, `=sub+iva` y fallback `en`), Presupuesto, CRM/Prospección (15 columnas exactas, estado `"Pendiente"`) y tabla genérica.

## 2. Prospección Web Fiable y Anti-ASR (`src/agent/agent.ts`, `src/tools/webSearch.ts`, `src/index.ts`)
- **System Prompt:** Añadir reglas explícitas de prospección (confirmación anti-ASR de ciudad/nicho ambiguo en 1 línea sin tools, default España, 10 fichas por defecto y máx. 15, flujo `web_search` → `read_url` home + `/contacto`, `NO ENCONTRADO` si falla un host, schema de 11 columnas, enlaces `[Nombre](url)` clicables, salida preferente `1× sheets_create` + `1× sheets_write` batch).
- **Continuaciones:** Normalizar tildes en `agent.ts` (`Continúa`, `Sigue`, `Ok`, etc.) y ampliar `hadToolActivity` para que `"Continúa"` o `"Ok"` tras prospección/búsqueda nunca caigan al fast-path sin herramientas.
- **Guardia post-`sheets_create` y cerca del límite:** Si se llamó `sheets_create` sin `sheets_write`/`sheets_append` en el turno, forzar `1× sheets_write` batch antes de responder; cerca de `MAX_ITERATIONS` (`12`), ordenar consolidación inmediata en Sheet + resumen.
- **Sin Edge-TTS largo en prospección (`src/index.ts`):** Omitir síntesis Edge-TTS cuando la respuesta sea un informe/tabla de prospección o entrega de Google Sheets.
- **`read_url` (`src/tools/webSearch.ts`):** Detección robusta de WhatsApp explícito (`wa.me`, `api.whatsapp.com`, `WhatsApp: +34...`) sin romper errores limpios de red (`ENOTFOUND`, `ECONNREFUSED`, `timeout`).

## 3. Google Sheets Batch + Coherencia de Cuenta (`src/tools/sheets.ts`, `src/tools/gogWrapper.ts`)
- Validar `spreadsheetId` y mantener `normalizeValuesMatrix` para aceptar `string | any[][]` en `sheets_write` con un solo `--values-json` (`USER_ENTERED`).
- En `gogWrapper.ts` (`ensureAccountParam`) y `sheets.ts`: garantizar coherencia con el email vinculado por `/auth` del `userId` activo, evitando mezclar cuentas (p. ej. `eduardoqm573@gmail.com` cuando el usuario vinculado es `eduardo@silvania.ai`), devolviendo aviso claro de `/auth` si falta token válido para un `userId` explícito.

## 4. Verificación (`scratch/` + `npm run build`)
- Script en `scratch/verify_p0_sheets_prospection.ts` validando:
  1. Matriz CRM (11+ columnas y 2 filas) → `normalizeValuesMatrix` y shape batch de `sheets_write`.
  2. Matriz de factura `es-ES` (`buildInvoiceMatrix`) con fórmulas vivas (`=B...*C...`, `=SUMA(...)`, `0,21` / `0.21`).
  3. Preservación de enlaces Markdown clicables (`[Nombre](url)`) en salida de prospección.
- `npm run build` sin errores.
