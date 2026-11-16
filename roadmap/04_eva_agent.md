# 04 · Roadmap Eva Agent (Educación Lúdica e Inclusiva)

## Estado Actual
- Base de ejercicios y backend clínico (`eva_clinical_backend.py`), detección de voz (`SileroVADController.ts`, `AudioInputManager.ts`) y landing `/eva`.

---

## Fases de Evolución

### Fase 1 · Mundos y Páginas de Juegos Interactivos
- **Mapa de mundos temáticos** (*Bosque de los Sonidos*, *Océano de las Sílabas*, *Espacio de las Palabras*, *Ciudad de los Cuentos*) donde cada página es un mini-juego adaptado a la edad y ritmo del niño.
- **Sistema de recompensas positivo:** estrellas, medallas y desbloqueo de mundos sin penalizar errores ("cada intento es aprendizaje").
- **Panel para padres y docentes/logopedas:** resumen visual de progreso semanal sin tecnicismos.

### Fase 2 · Lectura Labial y Feedback Articulatorio en Tiempo Real
- **Análisis visual de boca/labios (MediaPipe / FaceMesh en navegador):** detección en tiempo real de apertura vocal, posición labial (/p/, /b/, /m/, /o/, /u/) y feedback visual amigable con avatar animado.
- **Fusión audio + vídeo:** combinar VAD/análisis acústico de fonemas con lectura labial para ayudar tanto en aprendizaje infantil como en refuerzo logopédico.

### Fase 3 · Tutoría Adaptativa y Pilotos en Colegios
- Currículum adaptativo que ajusta la dificultad automáticamente según aciertos y fluidez.
- Licencias para centros educativos y gabinetes psicopedagógicos.

