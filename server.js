import express from "express";
import { config, validateConfig } from "./src/config/environment.js";
import { configureMiddleware } from "./src/middleware/index.js";
import { initializeCronJobs } from "./src/services/cronService.js";
import { firebaseInitialized } from "./src/config/firebase.js";
import routes from "./src/routes/index.js";

const app = express();
const PORT = config.port;

// Validate environment configuration
validateConfig();

// Configure middleware
configureMiddleware(app);

// Mount all routes
app.use(routes);

// Initialize cron jobs
initializeCronJobs();

// Start the Server
app.listen(PORT, () => {
    console.log(`Ì∫Ä Server running on http://localhost:${PORT}`);
    console.log(`Ì≥ù Daily Logs Slack endpoint: http://localhost:${PORT}/send-dailylog-slack`);
    console.log(`Ì¥ó Slack webhook endpoint: http://localhost:${PORT}/slack-webhook`);
    console.log(`Ì¥• Firebase Admin SDK: ${firebaseInitialized ? "‚úÖ Enabled" : "‚ö†Ô∏è Disabled"}`);
    console.log(`Ì≥° Server ready for Slack integration!`);
});
