import { createExpressApp } from './index.js';
import { logger } from '../utils/logger.js';
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const app = createExpressApp();
app.listen(PORT, () => { logger.info(`GitStore server running at http://localhost:${PORT}`); });
