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
    console.log(`� Server running on http://localhost:${PORT}`);
    console.log(`� Daily Logs Slack endpoint: http://localhost:${PORT}/send-dailylog-slack`);
    console.log(`� Slack webhook endpoint: http://localhost:${PORT}/slack-webhook`);
    console.log(`� Firebase Admin SDK: ${firebaseInitialized ? "✅ Enabled" : "⚠️ Disabled"}`);
    console.log(`� Server ready for Slack integration!`);
});
