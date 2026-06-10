import { loadSkillsSummary } from "../src/tools/index.js";

async function test() {
  try {
    const summary = await loadSkillsSummary();
    console.log("Skills Summary:");
    console.log(summary);
  } catch (error) {
    console.error("Error loading skills summary:", error);
  }
}

test();
