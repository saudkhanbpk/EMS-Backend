import express from "express";
import {
    generateDailyPDF,
    generateWeeklyPDF,
    generateFilteredPDF,
    generateMonthlyPDF,
    generateFilteredEmployeePDF,
    generateWeeklyEmployeePDF,
    generateMonthlyEmployeePDF
} from "../controllers/pdfController.js";

const router = express.Router();

// Generate daily attendance PDF
router.post("/generate-pdfDaily", generateDailyPDF);

// Generate weekly attendance PDF
router.post("/generate-pdfWeekly", generateWeeklyPDF);

// Generate filtered attendance PDF
router.post("/generate-Filtered", generateFilteredPDF);

// Generate monthly attendance PDF
router.post("/generate-pdfMonthly", generateMonthlyPDF);

// Generate filtered employee attendance PDF
router.post("/generate-pdfFilteredOfEmployee", generateFilteredEmployeePDF);

// Generate weekly employee attendance PDF
router.post("/generate-pdfWeeklyOfEmployee", generateWeeklyEmployeePDF);

// Generate monthly employee attendance PDF
router.post("/generate-pdfMonthlyOfEmployee", generateMonthlyEmployeePDF);

export default router;
