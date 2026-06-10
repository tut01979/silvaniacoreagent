
import { dbService } from './src/database/db.js';
async function run() {
  const history = await dbService.getHistory(1572946817, 50);
  console.log(JSON.stringify(history, null, 2));
}
run().catch(console.error);
