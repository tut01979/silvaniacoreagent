import fs from "fs";
import path from "path";
import axios from "axios";

interface UniversePhoto {
  universe: "cosmos" | "scifi_holograms" | "fantasy_tales" | "faith_bible" | "nature_climates" | "emotions";
  filename: string;
  unsplashId: string;
  description: string;
}

const UNIVERSAL_PHOTOS: UniversePhoto[] = [
  // 1. COSMOS & UNIVERSO & PLANETAS & ALIENS
  {
    universe: "cosmos",
    filename: "cosmos_nebula_deepspace_01.jpg",
    unsplashId: "photo-1462331940025-496dfbfc7564",
    description: "Nebulosa cósmica profunda con nubes de gas brillantes y estrellas distantes"
  },
  {
    universe: "cosmos",
    filename: "cosmos_earth_orbit_02.jpg",
    unsplashId: "photo-1451187580459-43490279c0fa",
    description: "Planeta visto desde la órbita espacial con atmósfera luminosa"
  },
  {
    universe: "cosmos",
    filename: "cosmos_galaxy_milkyway_03.jpg",
    unsplashId: "photo-1506703719100-a0f3a48c0f86",
    description: "Vía láctea y millones de estrellas en el cielo nocturno profundo"
  },
  {
    universe: "cosmos",
    filename: "cosmos_alien_landscape_04.jpg",
    unsplashId: "photo-1518709268805-4e9042af9f23",
    description: "Paisaje exoplanetario de otro mundo con relieve misterioso y estrellas"
  },

  // 2. CIENCIA, TECNOLOGÍA & HOLOGRAMAS 3D
  {
    universe: "scifi_holograms",
    filename: "scifi_hologram_matrix_01.jpg",
    unsplashId: "photo-1526374965328-7f61d4dc18c5",
    description: "Matriz digital holográfica con datos flotantes en 3D y luz cian"
  },
  {
    universe: "scifi_holograms",
    filename: "scifi_neural_network_02.jpg",
    unsplashId: "photo-1518770660439-4636190af475",
    description: "Red neuronal y circuitos de silicio iluminados con pulsos bioluminiscentes"
  },
  {
    universe: "scifi_holograms",
    filename: "scifi_cyber_lab_03.jpg",
    unsplashId: "photo-1535223289827-42f1e9919769",
    description: "Laboratorio futurista de realidad aumentada y pantallas translúcidas"
  },
  {
    universe: "scifi_holograms",
    filename: "scifi_abstract_energy_04.jpg",
    unsplashId: "photo-1508739773434-c26b3d09e071",
    description: "Ondas cuánticas y haces de energía holográfica en el espacio"
  },

  // 3. CUENTOS INFANTILES & FANTASÍA & PIXAR
  {
    universe: "fantasy_tales",
    filename: "fantasy_enchanted_forest_01.jpg",
    unsplashId: "photo-1511497584788-87676104235f",
    description: "Bosque mágico encantado con rayos dorados de sol entre árboles altos"
  },
  {
    universe: "fantasy_tales",
    filename: "fantasy_magical_castle_02.jpg",
    unsplashId: "photo-1518709268805-4e9042af9f23",
    description: "Reino de fantasía y misterio con atmósfera de cuento"
  },
  {
    universe: "fantasy_tales",
    filename: "fantasy_starry_wonderland_03.jpg",
    unsplashId: "photo-1519681393784-d120267933ba",
    description: "Montañas nevadas bajo cielo de estrellas y polvo de hadas"
  },
  {
    universe: "fantasy_tales",
    filename: "fantasy_cute_fox_04.jpg",
    unsplashId: "photo-1474511320723-9a56873867b5",
    description: "Zorrito entrañable de cuento en la naturaleza con mirada tierna"
  },

  // 4. CRISTIANISMO, LA BIBLIA & FE
  {
    universe: "faith_bible",
    filename: "faith_celestial_sunrays_01.jpg",
    unsplashId: "photo-1509316975850-ff9c5deb0cd9",
    description: "Rayos de luz celestial rompiendo a través de nubes doradas sobre el desierto"
  },
  {
    universe: "faith_bible",
    filename: "faith_holy_mountain_02.jpg",
    unsplashId: "photo-1464822759023-fed622ff2c3b",
    description: "Montaña sagrada al amanecer simbolizando fe y trascendencia"
  },
  {
    universe: "faith_bible",
    filename: "faith_ancient_sanctuary_03.jpg",
    unsplashId: "photo-1506744038136-46273834b3fb",
    description: "Piedras antiguas y paisaje histórico de Tierra Santa al atardecer"
  },
  {
    universe: "faith_bible",
    filename: "faith_scriptures_candlelight_04.jpg",
    unsplashId: "photo-1532012164546-f432f2e3777f",
    description: "Libro de escrituras sagradas abierto con luz cálida e íntima"
  },

  // 5. PAISAJES, NATURALEZA & CLIMAS EXTREMOS
  {
    universe: "nature_climates",
    filename: "nature_aurora_borealis_01.jpg",
    unsplashId: "photo-1531366936337-7c912a4589a7",
    description: "Aurora boreal verde y esmeralda bailando en el cielo polar ártico"
  },
  {
    universe: "nature_climates",
    filename: "nature_lightning_storm_02.jpg",
    unsplashId: "photo-1509114397022-ed747cca3f65",
    description: "Tormenta eléctrica con relámpagos iluminando la noche"
  },
  {
    universe: "nature_climates",
    filename: "nature_ocean_wave_03.jpg",
    unsplashId: "photo-1507525428034-b723cf961d3e",
    description: "Océano majestuoso con aguas turquesas y luz del sol brillante"
  },
  {
    universe: "nature_climates",
    filename: "nature_snowy_peaks_04.jpg",
    unsplashId: "photo-1486870591958-9b9d0d1dda99",
    description: "Cumbres nevadas imponentes de la cordillera bajo un cielo limpio"
  },

  // 6. EMOCIONES & PSICOLOGÍA HUMANA
  {
    universe: "emotions",
    filename: "emotion_awe_wonder_01.jpg",
    unsplashId: "photo-1507003211169-0a1dd7228f2d",
    description: "Rostro humano expresando asombro, inspiración y visión de futuro"
  },
  {
    universe: "emotions",
    filename: "emotion_inner_peace_02.jpg",
    unsplashId: "photo-1544005313-94ddf0286df2",
    description: "Expresión de serenidad profunda, calma y paz interior"
  },
  {
    universe: "emotions",
    filename: "emotion_focus_resilience_03.jpg",
    unsplashId: "photo-1534528741775-53994a69daeb",
    description: "Mirada de determinación, concentración y superación personal"
  }
];

async function main() {
  console.log(`🌌 Descargando suite universal expandida (${UNIVERSAL_PHOTOS.length} imágenes)...`);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < UNIVERSAL_PHOTOS.length; i++) {
    const item = UNIVERSAL_PHOTOS[i];
    const targetDir = path.resolve(process.cwd(), "src/marketing/assets/visuals", item.universe);
    fs.mkdirSync(targetDir, { recursive: true });

    const targetFile = path.join(targetDir, item.filename);
    const imageUrl = `https://images.unsplash.com/${item.unsplashId}?w=1280&h=720&fit=crop&q=85`;

    try {
      console.log(`[${i + 1}/${UNIVERSAL_PHOTOS.length}] 📥 [${item.universe.toUpperCase()}]: ${item.description}...`);
      const resp = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 20000,
      });

      if (resp.status === 200 && resp.data.length > 8000) {
        fs.writeFileSync(targetFile, resp.data);
        console.log(`  ✅ Guardada: ${item.filename} (${(resp.data.length / 1024).toFixed(1)} KB)`);
        ok++;
      } else {
        console.warn(`  ⚠️ Status ${resp.status}`);
        fail++;
      }
    } catch (err: any) {
      console.warn(`  ❌ Error descargando ${item.filename}:`, err.message);
      fail++;
    }

    await new Promise(r => setTimeout(r, 350));
  }

  console.log(`\n🎉 Descarga universal finalizada: ${ok} imágenes listas en local, ${fail} fallidas.`);
}

main().catch(err => {
  console.error("Error en descarga universal:", err);
  process.exit(1);
});
