import fs from "fs";
import path from "path";

const skillsDir = path.resolve("skills");
const repoDir = path.resolve("skills_repository");

if (!fs.existsSync(repoDir)) {
  fs.mkdirSync(repoDir, { recursive: true });
}

if (fs.existsSync(skillsDir)) {
  const items = fs.readdirSync(skillsDir);
  for (const item of items) {
    if (item === "skill-manager") continue;

    const sourcePath = path.join(skillsDir, item);
    const destPath = path.join(repoDir, item);

    try {
      console.log(`Moving ${item} -> ${destPath}`);
      fs.renameSync(sourcePath, destPath);
    } catch (err: any) {
      console.error(`Failed to move ${item}:`, err.message);
    }
  }
}
console.log("Done moving non-essential skills to repository.");
