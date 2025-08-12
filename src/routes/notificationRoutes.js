import express from "express";
import { sendNotifications, sendSingleNotification } from "../controllers/notificationController.js";

const router = express.Router();

// Send notifications to all users
router.post("/send-notifications", sendNotifications);

// Send notification to a single user
router.post("/send-singlenotifications", sendSingleNotification);

export default router;
