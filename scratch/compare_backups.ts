import fs from "fs";
import path from "path";

const dirCurrent = path.join(process.cwd(), "src");
const dirOld = "C:\\Users\\eduar\\silvaniacoreagent - copia\\src";

function getFiles(dir: string, baseDir: string = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, baseDir));
    } else {
      results.push(path.relative(baseDir, filePath));
    }
  });
  return results;
}

async function compare() {
  console.log("🔍 Comparando directorios de código fuente...");
  const filesCurrent = getFiles(dirCurrent);
  const filesOld = getFiles(dirOld);

  const allFiles = Array.from(new Set([...filesCurrent, ...filesOld]));
  const added: string[] = [];
  const deleted: string[] = [];
  const modified: string[] = [];
  const identical: string[] = [];

  allFiles.forEach((file) => {
    const pathCurrent = path.join(dirCurrent, file);
    const pathOld = path.join(dirOld, file);

    const existsCurrent = fs.existsSync(pathCurrent);
    const existsOld = fs.existsSync(pathOld);

    if (existsCurrent && !existsOld) {
      added.push(file);
    } else if (!existsCurrent && existsOld) {
      deleted.push(file);
    } else {
      const contentCurrent = fs.readFileSync(pathCurrent, "utf-8");
      const contentOld = fs.readFileSync(pathOld, "utf-8");
      if (contentCurrent !== contentOld) {
        modified.push(file);
      } else {
        identical.push(file);
      }
    }
  });

  console.log("\n=== RESULTADO DE COMPARACIÓN ===");
  console.log(`✨ Total archivos analizados: ${allFiles.length}`);
  console.log(`✅ Idénticos: ${identical.length}`);
  console.log(`➕ Creados en el proyecto actual: ${added.length}`);
  console.log(`➖ Eliminados en el proyecto actual: ${deleted.length}`);
  console.log(`📝 Modificados: ${modified.length}`);

  if (added.length > 0) {
    console.log("\n➕ Archivos creados nuevos:");
    added.forEach(f => console.log(`  - ${f}`));
  }

  if (deleted.length > 0) {
    console.log("\n➖ Archivos eliminados:");
    deleted.forEach(f => console.log(`  - ${f}`));
  }

  if (modified.length > 0) {
    console.log("\n📝 Archivos modificados:");
    modified.forEach(f => {
      const statsCurrent = fs.statSync(path.join(dirCurrent, f));
      const statsOld = fs.statSync(path.join(dirOld, f));
      console.log(`  - ${f} (Actual: ${statsCurrent.size} bytes | Antiguo: ${statsOld.size} bytes)`);
    });
  }
}

compare();
