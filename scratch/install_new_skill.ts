import { installSkill } from "../src/tools/skills.js";
import path from "path";
import fs from "fs";

async function run() {
    console.log("Iniciando instalación de habilidad...");
    const skillId = "skill-finder-installer";
    const result = await installSkill(skillId);
    console.log(result);
}

run().catch(console.error);
