import app from './app.js';
import { env } from './config/env.js';

// Vercel imports the app as a serverless handler; anywhere else, listen.
if (!env.IS_VERCEL) {
    app.listen(env.PORT, () => {
        console.log(`CRM API listening on port ${env.PORT}`);
    });
}

export default app;
