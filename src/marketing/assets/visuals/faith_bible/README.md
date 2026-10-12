# FAITH_BIBLE — Biblioteca de Activos Visuales Cinematográficos

**Propósito:** Repositorio local de imágenes 16:9 de alta resolución para el universo temático `faith_bible` (Relatos Bíblicos, Vida de Jesús, Fe y Esperanza).  
**Destino en el pipeline:** Stills visuales utilizados por `visualAssetSelector`, renderizados con franja inferior en `slideRenderer` y ensamblados en vídeo MP4 mediante `videoAssembler` y FFmpeg.

---

## 📐 Criterios Técnicos Obligatorios

1. **Aspect Ratio:** **16:9 estricto** (Resolución: `1280×720` o `1920×1080`). Sin bandas negras laterales ni superiores.
2. **Formato:** **JPEG (`.jpg` o `.jpeg`)** con compresión de calidad 85–90%.
3. **Peso por archivo:** **< 600 KB** (idealmente entre 150 KB y 450 KB) para optimizar memoria y tiempo de compilación de vídeo.
4. **Regla Zero-Text:** **Cero letras, palabras, versículos o marcas de agua en la imagen**. El título del capítulo, badge y subtítulos sincronizados se renderizan dinámicamente por software con `@napi-rs/canvas`.
5. **Estética:** Fotorealismo cinematográfico de época bíblica (35mm, iluminación claroscuro Rembrandt, tonos tierra/ocre, lino y barro auténticos).

---

## 🏷️ Convención de Nombres (Naming Convention)

Todos los archivos deben nombrarse estrictamente en minúsculas y sin acentos con el siguiente patrón:

```text
faith_<subcategoria>_<01-05>.jpg
```

**Ejemplos válidos:**
- `faith_nativity_01.jpg`
- `faith_baptism_02.jpg`
- `faith_wilderness_03.jpg`
- `faith_empty_tomb_04.jpg`
- `faith_scriptures_05.jpg`

---

## 📊 Las 12 Subcategorías y Cuotas Objetivo (Total: 64 imágenes)

| # | Subcategoría | Prefijo de Archivo | Conteo Objetivo | Descripción del Plano |
| :-: | :--- | :--- | :-: | :--- |
| **1** | **Natividad & Belén** | `faith_nativity_` | **5** | Pesebre humilde, estrella tenue, José y María en penumbra cálida. |
| **2** | **Bautismo en el Jordán** | `faith_baptism_` | **5** | Río Jordán al amanecer, inmersión sagrada, rayos dorados en agua. |
| **3** | **Desierto & Tentación** | `faith_wilderness_` | **6** | Riscos y dunas áridas de Judea, 40 días de soledad y oración. |
| **4** | **Sermón del Monte** | `faith_sermon_mount_` | **6** | Colina verde sobre Galilea, multitud atenta, enseñanza al aire libre. |
| **5** | **Milagros en Galilea** | `faith_galilee_sea_` | **5** | Barca en tormenta embravecida vs. calma total milagrosa. |
| **6** | **Última Cena** | `faith_last_supper_` | **5** | Aposento alto, mesa baja con pan ácimo, copas de barro y vino. |
| **7** | **Getsemaní & Oración** | `faith_gethsemane_` | **5** | Olivos milenarios de noche, luz de luna plateada, entrega ferviente. |
| **8** | **Vía Dolorosa** | `faith_via_dolorosa_` | **6** | Calles de Jerusalén en contraluz polvoriento, peso de la cruz. |
| **9** | **La Cruz & Crucifixión** | `faith_crucifixion_` | **6** | Tres cruces en la colina en silueta bajo cielo sombrío de tormenta. |
| **10** | **Tumba Vacía & Resurrección**| `faith_empty_tomb_` | **6** | Piedra rodada, sepulcro excavado bañado en luz radiante de amanecer. |
| **11** | **Luz Celestial & Gloria** | `faith_celestial_light_`| **5** | Haces de luz divina dorada rompiendo nubes sobre Tierra Santa. |
| **12** | **Escrituras & Pergaminos** | `faith_scriptures_` | **4** | Rollos antiguos de piel, mesa de madera, lámpara de aceite de barro. |
| **TOTAL** | **12 SUBCATEGORÍAS** | — | **64** | **Biblioteca completa sin repetición para cuentos y vídeos de fe.** |

---

## 🛠️ Generación de Prompts

Para consultar los 60 prompts en inglés listos para copiar y generar en Google Flow, Nano Banana o ImageFX, consulta:
👉 [`docs/marketing-studio/FAITH_BIBLE_PROMPTS.md`](file:///c:/Users/eduar/silvaniacoreagent/docs/marketing-studio/FAITH_BIBLE_PROMPTS.md)
