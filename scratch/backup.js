import fs from "fs";
import path from "path";

const SOURCE_DIR = process.cwd();
const TARGET_DIR = path.join(path.dirname(SOURCE_DIR), "silvaniacoreagent_backup");

const EXCLUDE_DIRS = [
  "node_modules",
  "dist",
  ".git",
  "temp",
  "silvaniacoreagent_backup"
];

function copyFolderRecursiveSync(source, target) {
  let files = [];

  // Check if folder needs to be created or integrated
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        const dirName = path.basename(curSource);
        if (EXCLUDE_DIRS.includes(dirName)) {
          console.log(`⏩ Omitiendo directorio: ${dirName}`);
          return;
        }
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        fs.copyFileSync(curSource, path.join(targetFolder, file));
      }
    });
  }
}

function runBackup() {
  console.log(`🚀 Iniciando copia de seguridad...`);
  console.log(`Origen: ${SOURCE_DIR}`);
  console.log(`Destino: ${TARGET_DIR}`);

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  const items = fs.readdirSync(SOURCE_DIR);
  let filesCopied = 0;
  let foldersCopied = 0;

  items.forEach((item) => {
    const srcPath = path.join(SOURCE_DIR, item);
    const isDir = fs.lstatSync(srcPath).isDirectory();

    if (isDir) {
      if (EXCLUDE_DIRS.includes(item)) {
        console.log(`⏩ Omitiendo directorio raíz: ${item}`);
        return;
      }
      console.log(`📁 Copiando carpeta: ${item}`);
      copyFolderRecursiveSync(srcPath, TARGET_DIR);
      foldersCopied++;
    } else {
      console.log(`📄 Copiando archivo: ${item}`);
      fs.copyFileSync(srcPath, path.join(TARGET_DIR, item));
      filesCopied++;
    }
  });

  console.log(`\n✅ Copia de seguridad completada con éxito.`);
  console.log(`📂 Carpetas copiadas en raíz: ${foldersCopied}`);
  console.log(`📄 Archivos copiados en raíz: ${filesCopied}`);
  console.log(`📍 Guardado en: ${TARGET_DIR}`);
}

runBackup();
