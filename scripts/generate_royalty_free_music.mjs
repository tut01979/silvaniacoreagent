import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

const MUSIC_ROOT = path.resolve(process.cwd(), "src/marketing/assets/music");
const MUSIC_META_PATH = path.resolve(
  process.cwd(),
  "src/marketing/assets/musicLibraryCatalog.json"
);

const SAMPLE_RATE = 44100;

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Soft warm synth waveform helpers
function softSaw(phase) {
  const p = phase - Math.floor(phase);
  return 2 * p - 1;
}

function softTriangle(phase) {
  const p = phase - Math.floor(phase);
  return 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25));
}

function softBell(phase, tNote) {
  const s1 = Math.sin(2 * Math.PI * phase);
  const s2 = 0.45 * Math.sin(4 * Math.PI * phase) * Math.exp(-tNote * 5);
  const s3 = 0.2 * Math.sin(6 * Math.PI * phase) * Math.exp(-tNote * 9);
  return s1 + s2 + s3;
}

function generateTrackSamples({
  durationSec,
  bpm,
  chords,
  arpPattern,
  padStyle,
  leadStyle,
  bassPulse,
  brightness,
}) {
  const totalSamples = Math.floor(durationSec * SAMPLE_RATE);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const beatSec = 60 / bpm;
  const chordDurationSec = beatSec * 4;
  const arpStepSec = beatSec / 2;

  // Low-pass filter state
  let lpL = 0;
  let lpR = 0;
  const lpAlpha = Math.min(0.65, Math.max(0.08, brightness));

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const chordIdx = Math.floor(t / chordDurationSec) % chords.length;
    const chord = chords[chordIdx];
    const tInChord = t % chordDurationSec;

    // Pad envelope (smooth swell per chord)
    const padEnv =
      Math.sin((Math.PI * Math.min(tInChord, chordDurationSec)) / chordDurationSec) * 0.45 + 0.55;

    let sumL = 0;
    let sumR = 0;

    // 1. Warm stereo chord pad
    for (let c = 0; c < chord.length; c++) {
      const freq = midiToFreq(chord[c]);
      const detune = 1 + (c % 2 === 0 ? 0.0022 : -0.0022);
      const pan = c / Math.max(1, chord.length - 1); // 0..1
      let val = 0;
      if (padStyle === "strings") {
        val =
          0.55 * Math.sin(2 * Math.PI * freq * t) +
          0.25 * softTriangle(freq * detune * t) +
          0.12 * softSaw(freq * 0.5 * t);
      } else if (padStyle === "dark_drone") {
        val =
          0.65 * Math.sin(2 * Math.PI * freq * t) +
          0.25 * Math.sin(2 * Math.PI * freq * 1.5 * t) * Math.sin(0.4 * t) +
          0.15 * softTriangle(freq * detune * t);
      } else {
        // warm_pad
        val =
          0.7 * Math.sin(2 * Math.PI * freq * t) +
          0.3 * Math.sin(2 * Math.PI * freq * detune * t);
      }
      sumL += val * padEnv * 0.14 * (1 - pan * 0.35);
      sumR += val * padEnv * 0.14 * (0.65 + pan * 0.35);
    }

    // 2. Sub/Warm Bass
    const bassFreq = midiToFreq(chord[0] - 12);
    const beatPos = (t % beatSec) / beatSec;
    const bassEnv = bassPulse
      ? Math.exp(-beatPos * 3.8) * 0.9 + 0.1
      : 0.7 + 0.3 * Math.sin(2 * Math.PI * (t / chordDurationSec));
    const bassVal =
      (0.78 * Math.sin(2 * Math.PI * bassFreq * t) +
        0.22 * softTriangle(bassFreq * 2 * t)) *
      bassEnv *
      0.22;
    sumL += bassVal;
    sumR += bassVal;

    // 3. Arpeggio / Melody voice
    if (arpPattern && arpPattern.length > 0) {
      const stepIdx = Math.floor(t / arpStepSec);
      const tInStep = t % arpStepSec;
      const patternVal = arpPattern[stepIdx % arpPattern.length];
      if (patternVal >= 0) {
        const noteMidi = chord[patternVal % chord.length] + (patternVal >= chord.length ? 12 : 0);
        const noteFreq = midiToFreq(noteMidi);
        const attack = Math.min(1, tInStep / 0.015);
        const decay = Math.exp(-tInStep * (leadStyle === "bell" ? 4.5 : 3.2));
        let lead = 0;
        if (leadStyle === "bell") {
          lead = softBell(noteFreq * t, tInStep);
        } else if (leadStyle === "brass") {
          lead =
            0.55 * softTriangle(noteFreq * t) +
            0.35 * Math.sin(2 * Math.PI * noteFreq * t) +
            0.15 * softSaw(noteFreq * 1.003 * t);
        } else {
          lead =
            0.65 * Math.sin(2 * Math.PI * noteFreq * t) +
            0.35 * softTriangle(noteFreq * 2 * t) * Math.exp(-tInStep * 6);
        }
        const stereoPan = (stepIdx % 2 === 0 ? 0.38 : 0.62);
        sumL += lead * attack * decay * 0.19 * (1 - stereoPan * 0.4);
        sumR += lead * attack * decay * 0.19 * (0.6 + stereoPan * 0.4);
      }
    }

    // Simple gentle low-pass smoothing for warm studio sound
    lpL = lpL + lpAlpha * (sumL - lpL);
    lpR = lpR + lpAlpha * (sumR - lpR);

    // Master fade in (1.5s) and fade out (2.2s)
    let masterEnv = 1;
    if (t < 1.5) masterEnv = t / 1.5;
    if (t > durationSec - 2.2) masterEnv = Math.max(0, (durationSec - t) / 2.2);

    left[i] = Math.tanh(lpL * masterEnv * 1.15) * 0.85;
    right[i] = Math.tanh(lpR * masterEnv * 1.15) * 0.85;
  }

  // Add subtle stereo delay / ambient tail (180ms & 270ms)
  const delayL = Math.floor(0.18 * SAMPLE_RATE);
  const delayR = Math.floor(0.27 * SAMPLE_RATE);
  for (let i = Math.max(delayL, delayR); i < totalSamples; i++) {
    left[i] = Math.tanh(left[i] + right[i - delayL] * 0.22);
    right[i] = Math.tanh(right[i] + left[i - delayR] * 0.22);
  }

  return { left, right };
}

function writeWav(wavPath, left, right) {
  const numSamples = left.length;
  const buffer = Buffer.alloc(44 + numSamples * 4);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 4, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(2, 22); // stereo
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 4, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buffer.writeInt16LE(Math.round(l * 32767), offset);
    buffer.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }
  fs.writeFileSync(wavPath, buffer);
}

const TRACKS = [
  // VICTORIA (3)
  {
    id: "mus_victoria_01",
    category: "victoria",
    relPath: "victoria/triunfo_corporativo_01.mp3",
    title: "Triunfo Corporativo Ascendente",
    description: "Acordes mayores luminosos con pulso enérgico y metales cálidos para celebrar logros y resultados.",
    emotions: ["victoria", "exito", "triunfo", "optimismo", "energia"],
    products: ["coreagent", "marketing", "eva"],
    objective: "Acompañar casos de éxito, cierres de venta y metas superadas.",
    keywords: ["victoria", "triunfo", "exito", "logro", "ganador", "resultados"],
    bpm: 112,
    durationSec: 28,
    chords: [[60, 64, 67, 72], [65, 69, 72, 77], [67, 71, 74, 79], [60, 64, 67, 72]],
    arpPattern: [0, 1, 2, 3, 2, 1, 2, 3],
    padStyle: "strings",
    leadStyle: "brass",
    bassPulse: true,
    brightness: 0.34,
  },
  {
    id: "mus_victoria_02",
    category: "victoria",
    relPath: "victoria/cima_alcanzada_02.mp3",
    title: "Cima Alcanzada",
    description: "Progresión heroica en Re mayor con arpegios brillantes que transmiten superación.",
    emotions: ["victoria", "orgullo", "superacion", "alegria"],
    products: ["marketing", "coreagent", "eva"],
    objective: "Reforzar mensajes de transformación positiva y récords.",
    keywords: ["cima", "victoria", "record", "superacion", "celebracion"],
    bpm: 118,
    durationSec: 28,
    chords: [[62, 66, 69, 74], [57, 61, 64, 69], [59, 62, 66, 71], [67, 71, 74, 79]],
    arpPattern: [0, 2, 1, 3, 2, 3, 1, 2],
    padStyle: "strings",
    leadStyle: "brass",
    bassPulse: true,
    brightness: 0.38,
  },
  {
    id: "mus_victoria_03",
    category: "victoria",
    relPath: "victoria/pulso_campeon_03.mp3",
    title: "Pulso de Campeón",
    description: "Ritmo firme y positivo con campanas suaves y base armónica sólida.",
    emotions: ["victoria", "determinacion", "confianza", "impulso"],
    products: ["coreagent", "marketing"],
    objective: "Ideal para llamadas a la acción finales y cierres inspiradores.",
    keywords: ["campeon", "victoria", "impulso", "cta", "cierre"],
    bpm: 116,
    durationSec: 28,
    chords: [[65, 69, 72, 77], [60, 64, 67, 72], [62, 65, 69, 74], [67, 71, 74, 79]],
    arpPattern: [0, -1, 1, 2, 3, 2, 1, 3],
    padStyle: "warm_pad",
    leadStyle: "bell",
    bassPulse: true,
    brightness: 0.32,
  },

  // GLORIA (3)
  {
    id: "mus_gloria_01",
    category: "gloria",
    relPath: "gloria/horizonte_epico_01.mp3",
    title: "Horizonte Épico de Gloria",
    description: "Cuerdas amplias y majestuosas con resonancia cinematográfica para lanzamientos estrella.",
    emotions: ["gloria", "grandeza", "asombro", "inspiracion", "majestad"],
    products: ["coreagent", "marketing", "eva"],
    objective: "Elevar la percepción de marca en lanzamientos y visiones de futuro.",
    keywords: ["gloria", "epico", "majestuoso", "grandeza", "lanzamiento", "cine"],
    bpm: 88,
    durationSec: 30,
    chords: [[57, 64, 69, 72], [65, 69, 72, 76], [60, 67, 72, 76], [67, 71, 74, 79]],
    arpPattern: [0, 1, 2, -1, 3, 2, 1, -1],
    padStyle: "strings",
    leadStyle: "brass",
    bassPulse: false,
    brightness: 0.28,
  },
  {
    id: "mus_gloria_02",
    category: "gloria",
    relPath: "gloria/amanecer_dorado_02.mp3",
    title: "Amanecer Dorado",
    description: "Textura orquestal cálida que crece suavemente evocando prestigio y éxito duradero.",
    emotions: ["gloria", "prestigio", "lujo", "esperanza"],
    products: ["coreagent", "marketing"],
    objective: "Acompañar escenas de oficinas de lujo, liderazgo y expansión.",
    keywords: ["amanecer", "gloria", "lujo", "prestigio", "expansion"],
    bpm: 84,
    durationSec: 30,
    chords: [[60, 67, 72, 76], [64, 67, 71, 76], [65, 69, 72, 77], [67, 71, 74, 79]],
    arpPattern: [0, 2, 3, 2, 1, 2, 3, -1],
    padStyle: "strings",
    leadStyle: "piano",
    bassPulse: false,
    brightness: 0.26,
  },
  {
    id: "mus_gloria_03",
    category: "gloria",
    relPath: "gloria/legado_luminoso_03.mp3",
    title: "Legado Luminoso",
    description: "Armonía amplia y solemne con destellos agudos que transmiten trascendencia.",
    emotions: ["gloria", "orgullo", "trascendencia", "emocion"],
    products: ["eva", "coreagent", "marketing"],
    objective: "Impactar emocionalmente en historias de propósito y visión.",
    keywords: ["legado", "gloria", "proposito", "emocion", "historia"],
    bpm: 90,
    durationSec: 30,
    chords: [[62, 69, 74, 78], [67, 71, 74, 79], [59, 66, 71, 74], [64, 69, 73, 76]],
    arpPattern: [0, -1, 2, 3, 1, -1, 2, 3],
    padStyle: "strings",
    leadStyle: "bell",
    bassPulse: false,
    brightness: 0.3,
  },

  // DESCUBRIMIENTOS (3)
  {
    id: "mus_desc_01",
    category: "descubrimientos",
    relPath: "descubrimientos/chispa_innovacion_01.mp3",
    title: "Chispa de Descubrimiento",
    description: "Campanas cristalinas y arpegios curiosos sobre colchón armónico cálido.",
    emotions: ["descubrimiento", "curiosidad", "asombro", "innovacion", "inteligencia"],
    products: ["coreagent", "marketing", "eva"],
    objective: "Ilustrar revelaciones de IA, búsqueda inteligente y nuevas ideas.",
    keywords: ["descubrimiento", "curiosidad", "innovacion", "revelacion", "ia", "idea"],
    bpm: 104,
    durationSec: 28,
    chords: [[60, 64, 67, 71], [62, 65, 69, 72], [64, 67, 71, 74], [65, 69, 72, 76]],
    arpPattern: [0, 2, 1, 3, 2, 4, 3, 1],
    padStyle: "warm_pad",
    leadStyle: "bell",
    bassPulse: false,
    brightness: 0.36,
  },
  {
    id: "mus_desc_02",
    category: "descubrimientos",
    relPath: "descubrimientos/exploracion_digital_02.mp3",
    title: "Exploración Digital",
    description: "Motivo rítmico curioso de marimba electrónica ideal para explicar tecnología.",
    emotions: ["descubrimiento", "claridad", "ciencia", "progreso"],
    products: ["coreagent", "marketing"],
    objective: "Explicar cómo funcionan los flujos de datos y analítica sin aburrir.",
    keywords: ["exploracion", "datos", "tecnologia", "descubrimiento", "explicacion"],
    bpm: 108,
    durationSec: 28,
    chords: [[64, 67, 71, 76], [60, 64, 67, 74], [62, 67, 71, 74], [65, 69, 72, 76]],
    arpPattern: [0, 1, 3, 2, 0, 2, 3, 1],
    padStyle: "warm_pad",
    leadStyle: "bell",
    bassPulse: true,
    brightness: 0.34,
  },
  {
    id: "mus_desc_03",
    category: "descubrimientos",
    relPath: "descubrimientos/nuevo_mundo_03.mp3",
    title: "Ventana a un Nuevo Mundo",
    description: "Melodía suave de descubrimiento infantil y científico con atmósfera abierta.",
    emotions: ["descubrimiento", "maravilla", "esperanza", "aprendizaje"],
    products: ["eva", "coreagent"],
    objective: "Perfecta para escenas educativas de Eva o demostraciones sorprendentes.",
    keywords: ["maravilla", "aprendizaje", "descubrimiento", "futuro", "eva"],
    bpm: 98,
    durationSec: 28,
    chords: [[65, 69, 72, 76], [67, 71, 74, 79], [64, 67, 71, 76], [60, 64, 67, 72]],
    arpPattern: [0, 2, 3, 1, 2, 3, 4, 2],
    padStyle: "strings",
    leadStyle: "bell",
    bassPulse: false,
    brightness: 0.35,
  },

  // SUSPENSE (3)
  {
    id: "mus_susp_01",
    category: "suspense",
    relPath: "suspense/tension_problema_01.mp3",
    title: "Tensión del Problema Oculto",
    description: "Sub-bajo pulsante y acordes menores contenidos para presentar el dolor o riesgo.",
    emotions: ["suspense", "urgencia", "problema", "intriga", "alerta"],
    products: ["coreagent", "marketing"],
    objective: "Abrir ganchos de vídeo exponiendo caos, pérdida de tiempo o competencia.",
    keywords: ["suspense", "tension", "problema", "urgencia", "caos", "riesgo"],
    bpm: 96,
    durationSec: 28,
    chords: [[57, 60, 64, 67], [56, 60, 63, 67], [55, 59, 62, 65], [53, 57, 60, 64]],
    arpPattern: [0, -1, 1, -1, 2, -1, 1, -1],
    padStyle: "dark_drone",
    leadStyle: "piano",
    bassPulse: true,
    brightness: 0.16,
  },
  {
    id: "mus_susp_02",
    category: "suspense",
    relPath: "suspense/reloj_corriendo_02.mp3",
    title: "Reloj Corriendo",
    description: "Pulso rítmico misterioso en modo menor que genera expectativa inmediata.",
    emotions: ["suspense", "expectativa", "misterio", "enfoque"],
    products: ["coreagent", "marketing"],
    objective: "Mantener atención durante diagnósticos o preguntas retóricas.",
    keywords: ["misterio", "expectativa", "suspense", "reloj", "atencion"],
    bpm: 105,
    durationSec: 28,
    chords: [[59, 62, 66, 69], [57, 60, 64, 67], [55, 58, 62, 65], [54, 58, 61, 66]],
    arpPattern: [0, 1, -1, 2, 0, -1, 1, 3],
    padStyle: "dark_drone",
    leadStyle: "bell",
    bassPulse: true,
    brightness: 0.19,
  },
  {
    id: "mus_susp_03",
    category: "suspense",
    relPath: "suspense/umbral_cambio_03.mp3",
    title: "En el Umbral del Cambio",
    description: "Atmósfera cinematográfica tensa que prepara el giro hacia la solución.",
    emotions: ["suspense", "intriga", "profundidad", "drama"],
    products: ["coreagent", "marketing", "eva"],
    objective: "Crear contraste dramático justo antes de revelar la solución Silvania.",
    keywords: ["drama", "intriga", "suspense", "giro", "contraste"],
    bpm: 90,
    durationSec: 28,
    chords: [[62, 65, 69, 72], [60, 63, 67, 70], [58, 62, 65, 69], [57, 61, 64, 69]],
    arpPattern: [0, -1, -1, 2, 1, -1, 2, -1],
    padStyle: "dark_drone",
    leadStyle: "piano",
    bassPulse: false,
    brightness: 0.17,
  },

  // INSPIRACION / ESPERANZA (3)
  {
    id: "mus_insp_01",
    category: "inspiracion",
    relPath: "inspiracion/calma_inspiradora_01.mp3",
    title: "Calma Inspiradora",
    description: "Piano suave y pads cálidos para historias humanas, empatía y propósito.",
    emotions: ["inspiracion", "calma", "esperanza", "empatia", "confianza"],
    products: ["eva", "coreagent", "marketing"],
    objective: "Acompañar testimonios, historias de docentes y mensajes humanos.",
    keywords: ["inspiracion", "calma", "esperanza", "humano", "empatia", "piano"],
    bpm: 86,
    durationSec: 30,
    chords: [[60, 64, 67, 72], [57, 60, 64, 69], [65, 69, 72, 76], [67, 71, 74, 79]],
    arpPattern: [0, 1, 2, 3, 1, 2, 3, 2],
    padStyle: "warm_pad",
    leadStyle: "piano",
    bassPulse: false,
    brightness: 0.25,
  },
  {
    id: "mus_insp_02",
    category: "inspiracion",
    relPath: "inspiracion/nuevo_comienzo_02.mp3",
    title: "Nuevo Comienzo",
    description: "Progresión serena y luminosa que transmite alivio y claridad mental.",
    emotions: ["alivio", "paz", "inspiracion", "claridad"],
    products: ["coreagent", "eva"],
    objective: "Mostrar el descanso y equilibrio recuperados tras automatizar.",
    keywords: ["alivio", "paz", "equilibrio", "comienzo", "inspiracion"],
    bpm: 92,
    durationSec: 30,
    chords: [[65, 69, 72, 76], [60, 64, 67, 72], [62, 65, 69, 74], [67, 71, 74, 79]],
    arpPattern: [0, 2, 1, 3, 0, 2, 3, 1],
    padStyle: "strings",
    leadStyle: "piano",
    bassPulse: false,
    brightness: 0.27,
  },
  {
    id: "mus_insp_03",
    category: "inspiracion",
    relPath: "inspiracion/futuro_humano_03.mp3",
    title: "Futuro Humano",
    description: "Armonía envolvente cálida ideal para visiones educativas y de bienestar.",
    emotions: ["esperanza", "ternura", "futuro", "confianza"],
    products: ["eva", "coreagent", "marketing"],
    objective: "Conectar tecnología con impacto humano positivo.",
    keywords: ["futuro", "humano", "esperanza", "bienestar", "inspiracion"],
    bpm: 88,
    durationSec: 30,
    chords: [[67, 71, 74, 79], [64, 67, 71, 76], [60, 64, 67, 72], [62, 66, 69, 74]],
    arpPattern: [0, 1, 2, 1, 3, 2, 1, 2],
    padStyle: "warm_pad",
    leadStyle: "piano",
    bassPulse: false,
    brightness: 0.26,
  },

  // PRODUCTIVIDAD CORPORATIVA (3)
  {
    id: "mus_corp_01",
    category: "productividad_corporativa",
    relPath: "productividad_corporativa/flujo_ejecutivo_01.mp3",
    title: "Flujo Ejecutivo Moderno",
    description: "Groove minimalista limpio y profesional para demos B2B y automatización.",
    emotions: ["productividad", "profesionalismo", "eficiencia", "control", "orden"],
    products: ["coreagent", "marketing"],
    objective: "Fondo neutro moderno para explicar CoreAgent, Google Workspace y flujos.",
    keywords: ["corporativo", "productividad", "b2b", "ejecutivo", "automatizacion", "moderno"],
    bpm: 114,
    durationSec: 28,
    chords: [[60, 64, 67, 71], [65, 69, 72, 76], [57, 60, 64, 67], [67, 71, 74, 77]],
    arpPattern: [0, 2, 1, 2, 3, 1, 2, 0],
    padStyle: "warm_pad",
    leadStyle: "piano",
    bassPulse: true,
    brightness: 0.29,
  },
  {
    id: "mus_corp_02",
    category: "productividad_corporativa",
    relPath: "productividad_corporativa/enfoque_tecnologico_02.mp3",
    title: "Enfoque Tecnológico",
    description: "Pulso constante y elegante que mantiene el ritmo sin distraer de la voz.",
    emotions: ["enfoque", "velocidad", "precision", "confianza"],
    products: ["coreagent", "marketing"],
    objective: "Sostener explicaciones técnicas o tutoriales corporativos.",
    keywords: ["enfoque", "tecnologia", "ritmo", "precision", "tutorial"],
    bpm: 118,
    durationSec: 28,
    chords: [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [65, 69, 72, 76]],
    arpPattern: [0, 1, 2, 3, 0, 1, 2, 1],
    padStyle: "warm_pad",
    leadStyle: "bell",
    bassPulse: true,
    brightness: 0.3,
  },
  {
    id: "mus_corp_03",
    category: "productividad_corporativa",
    relPath: "productividad_corporativa/oficina_inteligente_03.mp3",
    title: "Oficina Inteligente",
    description: "Textura limpia y sofisticada con notas cristalinas de alta gama.",
    emotions: ["sofisticacion", "orden", "productividad", "calidad"],
    products: ["coreagent", "marketing"],
    objective: "Ambientar presentaciones ejecutivas y campañas B2B premium.",
    keywords: ["oficina", "lujo", "sofisticacion", "corporativo", "workspace"],
    bpm: 110,
    durationSec: 28,
    chords: [[64, 67, 71, 74], [60, 64, 67, 71], [65, 69, 72, 76], [62, 66, 69, 74]],
    arpPattern: [0, -1, 2, 1, 3, 2, 1, -1],
    padStyle: "warm_pad",
    leadStyle: "piano",
    bassPulse: true,
    brightness: 0.28,
  },

  // INFANTIL EVA (3)
  {
    id: "mus_eva_01",
    category: "infantil_eva",
    relPath: "infantil_eva/sonrisa_aula_01.mp3",
    title: "Sonrisa en el Aula",
    description: "Melodía dulce tipo xilófono y cajita musical alegre para educación infantil.",
    emotions: ["alegria", "ternura", "juego", "diversion", "calidez"],
    products: ["eva"],
    objective: "Acompañar vídeos de aulas escolares, niños felices y juegos educativos.",
    keywords: ["infantil", "eva", "niños", "colegio", "xilofono", "juego", "ternura"],
    bpm: 108,
    durationSec: 28,
    chords: [[60, 64, 67, 72], [65, 69, 72, 77], [67, 71, 74, 79], [60, 64, 67, 72]],
    arpPattern: [0, 1, 2, 3, 2, 3, 1, 0],
    padStyle: "warm_pad",
    leadStyle: "bell",
    bassPulse: false,
    brightness: 0.4,
  },
  {
    id: "mus_eva_02",
    category: "infantil_eva",
    relPath: "infantil_eva/cuento_magico_02.mp3",
    title: "Cuento Mágico de Eva",
    description: "Arpegio suave y encantador que evoca imaginación, paciencia y aprendizaje feliz.",
    emotions: ["magia", "ternura", "imaginacion", "paciencia"],
    products: ["eva"],
    objective: "Ideal para escenas de profesora robot, cuentos y terapia del habla.",
    keywords: ["cuento", "magia", "eva", "profesora", "habla", "infantil"],
    bpm: 96,
    durationSec: 28,
    chords: [[65, 69, 72, 77], [60, 64, 67, 72], [62, 65, 69, 74], [67, 71, 74, 79]],
    arpPattern: [0, 2, 3, 1, 2, 4, 3, 2],
    padStyle: "warm_pad",
    leadStyle: "bell",
    bassPulse: false,
    brightness: 0.37,
  },
  {
    id: "mus_eva_03",
    category: "infantil_eva",
    relPath: "infantil_eva/pasos_pequeños_03.mp3",
    title: "Pequeños Grandes Pasos",
    description: "Música optimista y amigable que celebra cada avance de los niños.",
    emotions: ["alegria", "orgullo", "superacion", "amistad"],
    products: ["eva"],
    objective: "Reforzar logros escolares y colaboración entre maestra humana, robot y alumnos.",
    keywords: ["avances", "niños", "escuela", "logros", "eva", "amistad"],
    bpm: 104,
    durationSec: 28,
    chords: [[67, 71, 74, 79], [60, 64, 67, 72], [65, 69, 72, 77], [62, 65, 69, 74]],
    arpPattern: [0, 1, 3, 2, 1, 3, 2, 0],
    padStyle: "strings",
    leadStyle: "bell",
    bassPulse: false,
    brightness: 0.38,
  },
];

async function main() {
  fs.mkdirSync(MUSIC_ROOT, { recursive: true });
  const catalog = [];

  for (const track of TRACKS) {
    const mp3Path = path.join(MUSIC_ROOT, track.relPath);
    const wavPath = mp3Path.replace(/\.mp3$/i, ".wav");
    fs.mkdirSync(path.dirname(mp3Path), { recursive: true });

    console.log(`🎵 Synthesizing ${track.relPath} (${track.category})...`);
    const { left, right } = generateTrackSamples(track);
    writeWav(wavPath, left, right);

    execSync(
      `"${ffmpegStatic}" -y -i "${wavPath}" -codec:a libmp3lame -b:a 192k -ar 44100 "${mp3Path}"`,
      { stdio: "ignore" }
    );
    fs.unlinkSync(wavPath);

    catalog.push({
      id: track.id,
      category: track.category,
      relPath: `src/marketing/assets/music/${track.relPath}`,
      title: track.title,
      description: track.description,
      emotions: track.emotions,
      products: track.products,
      objective: track.objective,
      keywords: track.keywords,
      bpm: track.bpm,
      durationSec: track.durationSec,
      copyrightStatus: "royalty_free_original",
    });
  }

  fs.writeFileSync(MUSIC_META_PATH, JSON.stringify(catalog, null, 2), "utf8");
  console.log(`\n✅ Generated ${catalog.length} royalty-free original MP3 tracks!`);
  console.log(`📁 Music catalog written to ${MUSIC_META_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

