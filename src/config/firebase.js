import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Convert ES module URL to file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase credentials (optional)
let serviceAccount = null;
let firebaseInitialized = false;

try {
    serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, "../../firebase-admin-sdk.json"), "utf8"));
    // Initialize Firebase Admin SDK
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log("✅ Firebase Admin SDK initialized successfully");
} catch (error) {
    console.log("⚠️ Firebase Admin SDK not initialized (file not found). Push notifications will be disabled.");
    console.log("📝 To enable push notifications, add firebase-admin-sdk.json file");
}

export { admin, firebaseInitialized };
