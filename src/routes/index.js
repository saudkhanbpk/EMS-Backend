import express from "express";
import notificationRoutes from "./notificationRoutes.js";
import slackRoutes from "./slackRoutes.js";
import emailRoutes from "./emailRoutes.js";
import pdfRoutes from "./pdfRoutes.js";

const router = express.Router();

// Mount all route modules
router.use(notificationRoutes);
router.use(slackRoutes);
router.use(emailRoutes);
router.use(pdfRoutes);

export default router;
