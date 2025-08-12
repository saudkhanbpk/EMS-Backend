import dotenv from "dotenv";

dotenv.config();

const config = {
    port: process.env.PORT || 5000,
    supabase: {
        url: process.env.VITE_SUPABASE_URL,
        anonKey: process.env.VITE_SUPABASE_ANON_KEY,
    },
    slack: {
        botToken: process.env.VITE_SLACK_BOT_USER_OAUTH_TOKEN,
        webhookUrl: process.env.VITE_SLACK_WEBHOOK_URL,
    },
    email: {
        user: process.env.VITE_EMAIL_USER,
        pass: process.env.VITE_EMAIL_PASS,
    },
    sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
    },
};

// Validate required environment variables
const validateConfig = () => {
    console.log("🚀 Starting server...");
    console.log("📡 Supabase URL:", config.supabase.url ? "✅ Set" : "❌ Missing");
    console.log("🔑 Slack Bot Token:", config.slack.botToken ? "✅ Set" : "❌ Missing");
    console.log("📧 Email User:", config.email.user ? "✅ Set" : "❌ Missing");
};

export { config, validateConfig };
