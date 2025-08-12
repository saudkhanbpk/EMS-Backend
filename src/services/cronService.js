import cron from "node-cron";
import { sendSlackNotification } from "./slackService.js";
import { fetchUsers, fetchHolidays } from "./attendanceService.js";

// Initialize all cron jobs
export const initializeCronJobs = () => {
    // Morning check-in reminder at 8:45 AM PKT
    cron.schedule("45 8 * * *", () => {
        sendSlackNotification("🌞 Good Morning! Please Don't Forget To Check In.");
    }, {
        timezone: "Asia/Karachi"
    });

    // Evening check-out reminder at 4:45 PM PKT
    cron.schedule("45 16 * * *", () => {
        sendSlackNotification("Hello Everyone! Ensure You Have Checked Out From EMS.");
    }, {
        timezone: "Asia/Karachi"
    });

    // Lunch break start reminder at 12:45 PM PKT
    cron.schedule("45 12 * * *", () => {
        sendSlackNotification("🔔 Reminder: Please Dont Forget To start Break!");
    }, {
        timezone: "Asia/Karachi"
    });

    // Lunch break end reminder at 1:45 PM PKT
    cron.schedule("45 13 * * *", () => {
        sendSlackNotification("🔔 Reminder: Please Dont Forget To End Break!");
    }, {
        timezone: "Asia/Karachi"
    });

    // Daily attendance processing at 9:00 PM PKT
    cron.schedule('0 21 * * *', async () => {
        console.log('Running fetchUsers cron job at 9:00 PM PKT...');
        await fetchHolidays(); // Fetch holidays before running fetchUsers
        await fetchUsers();
    }, {
        timezone: 'Asia/Karachi'
    });

    console.log("✅ All cron jobs initialized successfully");
};
