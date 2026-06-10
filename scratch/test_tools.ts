import { driveMkdir, driveUpload, driveList } from "../src/tools/drive.js";
import { calendarCreate, calendarList } from "../src/tools/calendar.js";
import { gmailList } from "../src/tools/gmail.js";

async function runTests() {
  console.log("🚀 Iniciando batería de pruebas...");
  
  try {
    console.log("--- TEST: DRIVE MKDIR ---");
    const mkdirRes = await driveMkdir("Carpeta_Test_Silvania_" + Date.now(), "root");
    console.log(mkdirRes);
    
    console.log("\n--- TEST: DRIVE LIST ---");
    const listRes = await driveList(undefined, true, 0);
    console.log(listRes.substring(0, 500) + "...");
    
    console.log("\n--- TEST: CALENDAR CREATE ---");
    // event 1 hr from now
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60000).toISOString();
    const end = new Date(now.getTime() + 120 * 60000).toISOString();
    const calCreateRes = await calendarCreate("Reunión de prueba", start, end, "Descripción test");
    console.log(calCreateRes);

    console.log("\n--- TEST: CALENDAR LIST ---");
    const calListRes = await calendarList(7);
    console.log(calListRes);
    
    console.log("\n--- TEST: GMAIL LIST ---");
    const gmailRes = await gmailList(3);
    console.log(gmailRes);

  } catch (err: any) {
    console.error("❌ FALLO EN LA BATERÍA DE PRUEBAS:", err.message);
  }
}

runTests();
