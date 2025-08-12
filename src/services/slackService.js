import fetch from "node-fetch";
import { config } from "../config/environment.js";

// Function to send Slack notifications for check-in and check-out reminders
export const sendSlackNotification = async (message) => {
    const SLACK_WEBHOOK_URL = config.slack.webhookUrl;

    if (!SLACK_WEBHOOK_URL) {
        console.error("Slack Webhook URL is missing!");
        return;
    }

    try {
        const response = await fetch(SLACK_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message }),
        });

        if (!response.ok) throw new Error("Failed to send Slack notification");

        console.log("Notification sent successfully!");
    } catch (error) {
        console.error("Error sending notification:", error);
    }
};
