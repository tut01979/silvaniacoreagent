import fs from "fs";
import path from "path";
import axios from "axios";

interface PhotoEntry {
  product: "coreagent" | "eva" | "marketing";
  category: string;
  filename: string;
  unsplashId: string;
  description: string;
}

const CURATED_REAL_PHOTOS: PhotoEntry[] = [
  // ==========================================
  // SILVANIA COREAGENT (Personas reales en oficinas, calendarios, finanzas, telegram)
  // ==========================================
  {
    product: "coreagent",
    category: "calendar",
    filename: "person_calendar_office_01.jpg",
    unsplashId: "photo-1573496359142-b8d87734a5a2",
    description: "Mujer ejecutiva sonriendo mientras revisa su agenda en portátil en oficina moderna con luz natural"
  },
  {
    product: "coreagent",
    category: "calendar",
    filename: "person_calendar_meeting_02.jpg",
    unsplashId: "photo-1517245386807-bb43f82c33c4",
    description: "Profesional en sala de conferencias coordinando reuniones y calendario"
  },
  {
    product: "coreagent",
    category: "calendar",
    filename: "person_calendar_mobile_03.jpg",
    unsplashId: "photo-1507679799987-c73779587ccf",
    description: "Empresario consultando su smartphone con café en mano organizando el día"
  },
  {
    product: "coreagent",
    category: "sheets",
    filename: "person_sheets_finance_01.jpg",
    unsplashId: "photo-1551288049-bebda4e38f71",
    description: "Analista financiero revisando hojas de cálculo y balances en pantalla ultrawide"
  },
  {
    product: "coreagent",
    category: "sheets",
    filename: "person_sheets_typing_02.jpg",
    unsplashId: "photo-1460925895917-afdab827c52f",
    description: "Manos escribiendo datos y métricas financieras en teclado de portátil"
  },
  {
    product: "coreagent",
    category: "sheets",
    filename: "person_sheets_balance_03.jpg",
    unsplashId: "photo-1454165804606-c3d57bc86b40",
    description: "Ejecutivo analizando presupuesto y balances contables con tranquilidad"
  },
  {
    product: "coreagent",
    category: "gmail",
    filename: "person_gmail_inboxzero_01.jpg",
    unsplashId: "photo-1522071820081-009f0129c71c",
    description: "Profesional cerrando portátil con satisfacción de Inbox Zero al atardecer"
  },
  {
    product: "coreagent",
    category: "gmail",
    filename: "person_gmail_drafting_02.jpg",
    unsplashId: "photo-1573497019940-1c28c88b4f3e",
    description: "Mujer redactando propuesta importante en cafetería luminosa"
  },
  {
    product: "coreagent",
    category: "telegram",
    filename: "person_telegram_voicememo_01.jpg",
    unsplashId: "photo-1519085360753-af0119f7cbe7",
    description: "Ejecutivo caminando por distrito financiero grabando nota de voz en Telegram"
  },
  {
    product: "coreagent",
    category: "telegram",
    filename: "person_telegram_chat_02.jpg",
    unsplashId: "photo-1512428559087-560fa5ceab42",
    description: "Primer plano de manos sosteniendo smartphone con chat de mensajería instantánea"
  },
  {
    product: "coreagent",
    category: "executive",
    filename: "person_executive_skyline_01.jpg",
    unsplashId: "photo-1486406146926-c627a92ad1ab",
    description: "Líder empresarial mirando horizonte de ciudad con visión y claridad"
  },
  {
    product: "coreagent",
    category: "executive",
    filename: "person_executive_workstation_02.jpg",
    unsplashId: "photo-1497366216548-37526070297c",
    description: "Despacho ejecutivo minimalista con portátil, orden absoluto y luz matutina"
  },

  // ==========================================
  // EVA (Personas reales: Niños, logopedas, familias, terapeutas)
  // ESTRICTAMENTE CERO TELEGRAM Y CERO GOOGLE
  // ==========================================
  {
    product: "eva",
    category: "speech_therapy",
    filename: "person_eva_therapist_child_01.jpg",
    unsplashId: "photo-1576765608535-5f04d1e3f289",
    description: "Logopeda sonriente guiando con cariño a un niño en ejercicio de articulación"
  },
  {
    product: "eva",
    category: "speech_therapy",
    filename: "person_eva_clinic_smile_02.jpg",
    unsplashId: "photo-1588072432836-e10032774350",
    description: "Especialista pediátrica y niña sonriendo durante sesión clínica interactiva"
  },
  {
    product: "eva",
    category: "speech_therapy",
    filename: "person_eva_cards_learning_03.jpg",
    unsplashId: "photo-1544717305-2782549b5136",
    description: "Terapeuta y niño practicando sonidos del habla con entusiasmo"
  },
  {
    product: "eva",
    category: "phonemes",
    filename: "person_eva_child_articulation_01.jpg",
    unsplashId: "photo-1485546246426-74dc88dec4d9",
    description: "Primer plano de niño con expresión alegre articulando fonemas con claridad"
  },
  {
    product: "eva",
    category: "phonemes",
    filename: "person_eva_girl_joy_02.jpg",
    unsplashId: "photo-1516627145497-ae6968895b74",
    description: "Niña riendo feliz durante juego vocal de pronunciación"
  },
  {
    product: "eva",
    category: "phonemes",
    filename: "person_eva_bubbles_breath_03.jpg",
    unsplashId: "photo-1502086223501-7ea6ecd79368",
    description: "Niño soplando pompas de jabón para practicar control respiratorio fonético"
  },
  {
    product: "eva",
    category: "child_session",
    filename: "person_eva_tablet_rug_01.jpg",
    unsplashId: "photo-1596464716127-f2a829822391",
    description: "Niño sentado en la alfombra de casa disfrutando de juego en tablet"
  },
  {
    product: "eva",
    category: "child_session",
    filename: "person_eva_boy_tablet_02.jpg",
    unsplashId: "photo-1503454537195-0deabb9327e5",
    description: "Niño interactuando con pantalla táctil en ambiente doméstico cálido"
  },
  {
    product: "eva",
    category: "child_session",
    filename: "person_eva_girl_tablet_03.jpg",
    unsplashId: "photo-1516733725897-1aa73b87c8e8",
    description: "Niña aprendiendo palabras y sonidos en tablet con luz natural"
  },
  {
    product: "eva",
    category: "family_progress",
    filename: "person_eva_mother_child_01.jpg",
    unsplashId: "photo-1491438590914-bc09fcaaf77a",
    description: "Madre e hijo hablando y riendo juntos con afecto y cercanía"
  },
  {
    product: "eva",
    category: "family_progress",
    filename: "person_eva_parents_consultation_02.jpg",
    unsplashId: "photo-1573496799652-408c2ac9fe98",
    description: "Padres atentos en consulta recibiendo informe positivo de progreso del habla"
  },
  {
    product: "eva",
    category: "clinical_web",
    filename: "person_eva_safe_home_01.jpg",
    unsplashId: "photo-1513159446162-54eb8bdaa79b",
    description: "Hogar tranquilo y protegido que simboliza la privacidad local del audio"
  },

  // ==========================================
  // MARKETING STUDIO (Personas reales: Creadores, cámaras, micrófonos, dashboards)
  // ==========================================
  {
    product: "marketing",
    category: "video_studio",
    filename: "person_mkt_podcast_studio_01.jpg",
    unsplashId: "photo-1590602847861-f357a9332bbc",
    description: "Estudio profesional de podcast y vídeo con micrófonos Shure y luces cálidas"
  },
  {
    product: "marketing",
    category: "video_studio",
    filename: "person_mkt_camera_operator_02.jpg",
    unsplashId: "photo-1492691527719-9d1e07e534b4",
    description: "Operador de cámara de cine en set de grabación profesional"
  },
  {
    product: "marketing",
    category: "video_studio",
    filename: "person_mkt_creator_desk_03.jpg",
    unsplashId: "photo-1598550476439-6847785fcea6",
    description: "Setup de creador de YouTube con teleprompter, cámara y luz suave"
  },
  {
    product: "marketing",
    category: "content_creation",
    filename: "person_mkt_video_editor_01.jpg",
    unsplashId: "photo-1574717024653-61fd2cf4d44d",
    description: "Editor de vídeo trabajando en timeline multitrack en sala de montaje"
  },
  {
    product: "marketing",
    category: "content_creation",
    filename: "person_mkt_storyboard_02.jpg",
    unsplashId: "photo-1531482615713-2afd69097998",
    description: "Directora creativa planificando ganchos y guion en pizarra digital"
  },
  {
    product: "marketing",
    category: "analytics_growth",
    filename: "person_mkt_growth_chart_01.jpg",
    unsplashId: "photo-1551288049-bebda4e38f71",
    description: "Estratega analizando gráfico de crecimiento viral y retención en pantalla"
  },
  {
    product: "marketing",
    category: "analytics_growth",
    filename: "person_mkt_metrics_review_02.jpg",
    unsplashId: "photo-1557804506-669a67965ba0",
    description: "Equipo de marketing celebrando métricas de retención y visitas orgánicas"
  },
  {
    product: "marketing",
    category: "social_channels",
    filename: "person_mkt_vertical_creator_01.jpg",
    unsplashId: "photo-1616469829941-c7200edec809",
    description: "Creadora grabando vídeo vertical para TikTok y Shorts con aro de luz"
  },
  {
    product: "marketing",
    category: "podcast",
    filename: "person_mkt_founder_hitl_01.jpg",
    unsplashId: "photo-1506794778202-cad84cf45f1d",
    description: "Fundador sonriendo al revisar y aprobar borrador en su móvil (Human-in-the-Loop)"
  },
];

async function downloadPhotos() {
  console.log(`📸 Descargando fotografías reales con personas y situaciones para la suite (${CURATED_REAL_PHOTOS.length} imágenes)...`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < CURATED_REAL_PHOTOS.length; i++) {
    const item = CURATED_REAL_PHOTOS[i];
    const targetDir = path.resolve(process.cwd(), "src/marketing/assets/visuals", item.product, item.category);
    fs.mkdirSync(targetDir, { recursive: true });

    const targetFile = path.join(targetDir, item.filename);

    const imageUrl = `https://images.unsplash.com/${item.unsplashId}?w=1280&h=720&fit=crop&crop=faces,entropy&q=85`;

    try {
      console.log(`[${i + 1}/${CURATED_REAL_PHOTOS.length}] 📥 ${item.product.toUpperCase()} (${item.category}): ${item.description}...`);
      const resp = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 20000,
      });

      if (resp.status === 200 && resp.data.length > 10000) {
        fs.writeFileSync(targetFile, resp.data);
        console.log(`  ✅ Guardada: ${item.filename} (${(resp.data.length / 1024).toFixed(1)} KB)`);
        ok++;
      } else {
        console.warn(`  ⚠️ Respuesta inesperada: status ${resp.status}`);
        fail++;
      }
    } catch (err: any) {
      console.warn(`  ❌ Error descargando ${item.filename}:`, err.message);
      fail++;
    }

    // Pausa breve
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n🎉 Descarga completada: ${ok} fotografías reales de alta resolución listas, ${fail} errores.`);
}

downloadPhotos().catch(err => {
  console.error("Fallo descargando fotografías:", err);
  process.exit(1);
});
