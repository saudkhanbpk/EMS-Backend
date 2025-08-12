import express from "express";
import {
    sendSlackApproval,
    sendSlackRejection,
    sendDailyLogSlack,
    debugUsersSlack,
    fixSlackIds,
    testSlackUser,
    testWebhook,
    getSlackMessages,
    slackWebhook
} from "../controllers/slackController.js";

const router = express.Router();

// Send Slack notification on request approval
router.post("/send-slack", sendSlackApproval);

// Send Slack notification on request rejection
router.post("/send-slackreject", sendSlackRejection);

// Send Daily Log message to Slack
router.post("/send-dailylog-slack", sendDailyLogSlack);

// Debug endpoint to check user slack_id
router.get("/debug-users-slack", debugUsersSlack);

// Fix slack_id whitespace in database
router.post("/fix-slack-ids", fixSlackIds);

// Test endpoint to find your Slack User ID
router.post("/test-slack-user", testSlackUser);

// Test endpoint to check if webhook is working
router.get("/test-webhook", testWebhook);

// API endpoint to get ALL Slack messages for a user
router.post("/api/get-slack-messages", getSlackMessages);

// Slack webhook for URL verification
router.post("/slack-webhook", slackWebhook);

export default router;
