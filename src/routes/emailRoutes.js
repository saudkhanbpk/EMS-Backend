import express from "express";
import {
    sendEmail,
    sendAlertEmail,
    sendAdminResponse,
    sendAdminResponseReject
} from "../controllers/emailController.js";

const router = express.Router();

// Send leave request email
router.post("/send-email", sendEmail);

// Send bulk alert email to users
router.post("/send-alertemail", sendAlertEmail);

// Send admin approval response
router.post("/send-response", sendAdminResponse);

// Send admin rejection response
router.post("/send-rejectresponse", sendAdminResponseReject);

export default router;
