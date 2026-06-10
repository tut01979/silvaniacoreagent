import { dbService } from '../src/database/db.js';
(async () => {
  try {
    const history = await dbService.getHistory(1572946817);
    console.log(JSON.stringify(history.slice(-30), null, 2));
  } catch (e) {
    console.error(e);
  }
})();
