import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch"; // Required for sending HTTP requests
import cron from "node-cron";
import nodemailer from "nodemailer"
import sendgrid from "@sendgrid/mail";
import PDFDocument from "pdfkit";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";
import bodyParser from "body-parser";
import path from "path";
import pdf from 'html-pdf'
import { fileURLToPath } from "url";
// Convert ES module URL to file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Read Firebase credentials (optional)
let serviceAccount = null;
let firebaseInitialized = false;

try {
    serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-admin-sdk.json"), "utf8"));
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

dotenv.config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 5000; // Set a default port

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

console.log("🚀 Starting server...");
console.log("📡 Supabase URL:", process.env.VITE_SUPABASE_URL ? "✅ Set" : "❌ Missing");
console.log("🔑 Slack Bot Token:", process.env.VITE_SLACK_BOT_USER_OAUTH_TOKEN ? "✅ Set" : "❌ Missing");

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// // Send notification To All Users With Fcm Token , On An Action performing API
// app.post("/send-notifications", async (req, res) => {
//     try {
//         const { title, body } = req.body;
//         if (!title || !body) return res.status(400).json({ message: "Title and body are required." });

//         const { data: users, error } = await supabase.from("users").select("fcm_token , full_name");
//         if (error) return res.status(500).json({ error });

//         const tokens = users.map(user => user.fcm_token).filter(token => token);
//         const user1 = users.map(user => user.full_name).filter(token => token);

//         if (tokens.length === 0) return res.status(400).json({ message: "No valid FCM tokens found." });

//         const message = {
//             notification: { title, body },
//             tokens
//         };

//         // const response = await admin.messaging().sendMulticast(message);
//         const response = await admin.messaging().sendEachForMulticast(message);

//         res.json({ success: true, response });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });


app.post("/send-notifications", async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({ error: "Push notifications are not available. Firebase Admin SDK not initialized." });
        }

        const { title, body, url } = req.body;
        if (!title || !body) return res.status(400).json({ message: "Title and Body are required." });

        // Fetch all FCM tokens with user information
        const { data: tokenData, error } = await supabase
            .from("fcm_tokens")
            .select("token, user_id, users(full_name)")
            .order("last_used_at", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        if (!tokenData || tokenData.length === 0) {
            return res.status(400).json({ message: "No valid FCM tokens found." });
        }

        // Create a base message template
        const baseMessage = {
            notification: {
                // Title and body will be customized per user
                icon: "/favicon.ico"
            },
            data: {
                url: url || "/",
                timestamp: String(Date.now())
            },
            // Set high priority for Android
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    priority: "high",
                    channelId: "general-notifications"
                }
            },
            // Configure for Apple devices
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1,
                        contentAvailable: true
                    }
                }
            },
            // Set web notification options
            webpush: {
                notification: {
                    icon: "/favicon.ico",
                    badge: "/favicon.ico",
                    vibrate: [200, 100, 200],
                    requireInteraction: true
                },
                fcmOptions: {
                    link: url || "/"
                }
            }
        };

        // Send notifications to all tokens
        const responses = await Promise.all(
            tokenData.map(async (item) => {
                try {
                    const userName = item.users?.full_name || "User";

                    const message = {
                        ...baseMessage,
                        token: item.token,
                        notification: {
                            ...baseMessage.notification,
                            title: `${userName}: ${title}`,
                            body: body
                        }
                    };

                    const response = await admin.messaging().send(message);
                    return { token: item.token, userId: item.user_id, success: true, response };
                } catch (sendError) {
                    // If the token is invalid, remove it from the database
                    if (sendError.code === 'messaging/invalid-registration-token' ||
                        sendError.code === 'messaging/registration-token-not-registered') {
                        try {
                            await supabase
                                .from("fcm_tokens")
                                .delete()
                                .eq("token", item.token);
                            console.log(`Removed invalid token: ${item.token}`);
                        } catch (deleteError) {
                            console.error("Error removing invalid token:", deleteError);
                        }
                    }
                    return { token: item.token, userId: item.user_id, success: false, error: sendError.message };
                }
            })
        );

        // Count successful notifications
        const successCount = responses.filter(r => r.success).length;

        console.log(`Sent ${successCount} notifications successfully out of ${tokenData.length} tokens`);
        res.json({
            success: successCount > 0,
            totalTokens: tokenData.length,
            successCount,
            responses
        });
    } catch (error) {
        console.error("Error sending notifications:", error);
        res.status(500).json({ error: error.message });
    }
});





app.post("/send-singlenotifications", async (req, res) => {
    try {
        const { title, body, fcmtoken, userId, taskId, projectId, url } = req.body;

        // Check if we have the required parameters
        if (!title || !body) {
            return res.status(400).json({ message: "Title and body are required." });
        }

        if (!fcmtoken && !userId) {
            return res.status(400).json({ message: "Either FCM token or user ID is required." });
        }

        // Create the base message payload
        const baseMessage = {
            notification: {
                title,
                body,
                // You can add an image URL here if needed
                // image: "https://example.com/notification-image.png"
            },
            data: {
                // Include additional data that can be used when the notification is clicked
                url: url || "/",
                taskId: taskId ? String(taskId) : "",
                projectId: projectId ? String(projectId) : "",
                timestamp: String(Date.now())
            },
            // Set high priority for Android
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    priority: "high",
                    channelId: "task-notifications"
                }
            },
            // Configure for Apple devices
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1,
                        contentAvailable: true
                    }
                }
            },
            // Set web notification options
            webpush: {
                notification: {
                    icon: "/favicon.ico",
                    badge: "/favicon.ico",
                    vibrate: [200, 100, 200],
                    requireInteraction: true
                },
                fcmOptions: {
                    link: url || "/"
                }
            }
        };

        let tokens = [];

        // If a specific token is provided, use it
        if (fcmtoken) {
            tokens.push(fcmtoken);
        }

        // If a user ID is provided, get all tokens for that user
        if (userId) {
            try {
                // First try to get tokens from the fcm_tokens table
                console.log(`Attempting to fetch tokens for user ${userId} from fcm_tokens table`);

                // Debug: Check if the table exists and its structure
                const { data: tableInfo, error: tableError } = await supabase
                    .from("fcm_tokens")
                    .select("*")
                    .limit(1);

                if (tableError) {
                    console.error("Error checking fcm_tokens table:", tableError.message);
                } else {
                    console.log("fcm_tokens table exists, sample data:", tableInfo);

                    // Debug: Check all tokens in the table
                    const { data: allTokens, error: allTokensError } = await supabase
                        .from("fcm_tokens")
                        .select("user_id, token")
                        .limit(10);

                    if (allTokensError) {
                        console.error("Error fetching sample tokens:", allTokensError.message);
                    } else {
                        console.log("Sample tokens in fcm_tokens table:", allTokens);
                    }
                }

                // Now try to get tokens for this specific user
                // Normalize the user_id to lowercase for consistency
                const normalizedUserId = userId.toLowerCase();
                console.log(`Using normalized user ID: ${normalizedUserId}`);

                // First try with the normalized user_id
                let { data: userTokens, error } = await supabase
                    .from("fcm_tokens")
                    .select("token, device_info")
                    .eq("user_id", normalizedUserId);

                console.log(`Query for user_id=${userId} returned:`, { data: userTokens, error });

                // If no results, try with case-insensitive comparison (UUID might be stored with different case)
                if (!error && (!userTokens || userTokens.length === 0)) {
                    console.log("No tokens found with exact match, trying case-insensitive search");

                    // Try to get all tokens and filter manually (not ideal but helps diagnose the issue)
                    const { data: allUserTokens, error: allError } = await supabase
                        .from("fcm_tokens")
                        .select("user_id, token, device_info");

                    if (!allError && allUserTokens && allUserTokens.length > 0) {
                        console.log(`Found ${allUserTokens.length} total tokens in the table`);

                        // Filter tokens manually with case-insensitive comparison
                        const matchingTokens = allUserTokens.filter(t =>
                            t.user_id && t.user_id.toLowerCase() === normalizedUserId
                        );

                        if (matchingTokens.length > 0) {
                            console.log(`Found ${matchingTokens.length} tokens with case-insensitive match`);
                            // Use these tokens instead
                            userTokens = matchingTokens;
                        } else {
                            console.log("No tokens found even with case-insensitive search");
                        }
                    }
                }

                if (error) {
                    // If there's an error (like table doesn't exist), try the users table as fallback
                    console.log("Error fetching from fcm_tokens table, trying users table as fallback:", error.message);

                    const { data: userData, error: userError } = await supabase
                        .from("users")
                        .select("fcm_token")
                        .eq("id", userId)
                        .single();

                    if (userError) {
                        console.error("Error fetching user FCM token from users table:", userError);
                    } else if (userData && userData.fcm_token) {
                        // Add the token from the users table, but first validate it
                        if (!tokens.includes(userData.fcm_token)) {
                            // Check if this token is valid (at least in format)
                            if (userData.fcm_token && userData.fcm_token.length > 20) {
                                tokens.push(userData.fcm_token);
                                console.log(`Using FCM token from users table as fallback: ${userData.fcm_token.substring(0, 20)}...`);
                            } else {
                                console.log("Found invalid token format in users table, skipping");

                                // Clear the invalid token
                                try {
                                    const { error: clearError } = await supabase
                                        .from("users")
                                        .update({ fcm_token: null })
                                        .eq("id", userId);

                                    if (!clearError) {
                                        console.log(`Cleared invalid token format from user ${userId}`);
                                    }
                                } catch (clearError) {
                                    console.error("Error clearing invalid token:", clearError);
                                }
                            }
                        }
                    }
                } else if (userTokens && userTokens.length > 0) {
                    // Add all user tokens to our tokens array, avoiding duplicates
                    console.log(`Found ${userTokens.length} tokens for user ${userId} in fcm_tokens table`);
                    userTokens.forEach(item => {
                        if (!tokens.includes(item.token)) {
                            tokens.push(item.token);
                            const deviceInfo = item.device_info ?
                                `(${JSON.parse(item.device_info).platform || 'unknown device'})` :
                                '(no device info)';
                            console.log(`Added token for user ${userId} ${deviceInfo}`);
                        } else {
                            console.log(`Skipping duplicate token for user ${userId}`);
                        }
                    });
                } else {
                    console.log(`No tokens found for user ${userId} in fcm_tokens table - userTokens:`, userTokens);

                    // Try the users table as fallback if no tokens found in fcm_tokens
                    const { data: userData, error: userError } = await supabase
                        .from("users")
                        .select("fcm_token")
                        .eq("id", userId)
                        .single();

                    if (userError) {
                        console.error("Error fetching user FCM token from users table:", userError);
                    } else if (userData && userData.fcm_token) {
                        // Add the token from the users table, but first validate it
                        if (!tokens.includes(userData.fcm_token)) {
                            // Check if this token is valid (at least in format)
                            if (userData.fcm_token && userData.fcm_token.length > 20) {
                                tokens.push(userData.fcm_token);
                                console.log(`Using FCM token from users table as fallback: ${userData.fcm_token.substring(0, 20)}...`);
                            } else {
                                console.log("Found invalid token format in users table, skipping");

                                // Clear the invalid token
                                try {
                                    const { error: clearError } = await supabase
                                        .from("users")
                                        .update({ fcm_token: null })
                                        .eq("id", userId);

                                    if (!clearError) {
                                        console.log(`Cleared invalid token format from user ${userId}`);
                                    }
                                } catch (clearError) {
                                    console.error("Error clearing invalid token:", clearError);
                                }
                            }
                        }
                    }
                }
            } catch (dbError) {
                console.error("Database error fetching tokens:", dbError);
            }
        }

        // If we have no tokens, return an error
        if (tokens.length === 0) {
            return res.status(400).json({ message: "No valid FCM tokens found for this user." });
        }

        // Send notifications to all tokens
        const responses = await Promise.all(
            tokens.map(async (token) => {
                try {
                    const message = { ...baseMessage, token };
                    const response = await admin.messaging().send(message);
                    return { token, success: true, response };
                } catch (sendError) {
                    // If the token is invalid, remove it from both tables
                    if (sendError.code === 'messaging/invalid-registration-token' ||
                        sendError.code === 'messaging/registration-token-not-registered') {
                        try {
                            // Remove from fcm_tokens table
                            const { error: tokenDeleteError } = await supabase
                                .from("fcm_tokens")
                                .delete()
                                .eq("token", token);

                            if (tokenDeleteError) {
                                console.error("Error removing token from fcm_tokens:", tokenDeleteError);
                            } else {
                                console.log(`Removed invalid token from fcm_tokens: ${token.substring(0, 20)}...`);
                            }

                            // Also check if this token is in the users table and clear it
                            const { data: usersWithToken, error: findError } = await supabase
                                .from("users")
                                .select("id")
                                .eq("fcm_token", token);

                            if (!findError && usersWithToken && usersWithToken.length > 0) {
                                // Clear the token from all users that have it
                                for (const user of usersWithToken) {
                                    const { error: clearError } = await supabase
                                        .from("users")
                                        .update({ fcm_token: null })
                                        .eq("id", user.id);

                                    if (clearError) {
                                        console.error(`Error clearing token from user ${user.id}:`, clearError);
                                    } else {
                                        console.log(`Cleared invalid token from user ${user.id}`);
                                    }
                                }
                            }
                        } catch (deleteError) {
                            console.error("Error removing invalid token:", deleteError);
                        }
                    }
                    return { token, success: false, error: sendError.message };
                }
            })
        );

        // Count successful notifications
        const successCount = responses.filter(r => r.success).length;

        console.log(`Sent ${successCount} notifications successfully out of ${tokens.length} tokens`);
        res.json({
            success: successCount > 0,
            totalTokens: tokens.length,
            successCount,
            responses
        });
    } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).json({ error: error.message });
    }
});





//Sending slack notoiifcation on request approval
app.post("/send-slack", async (req, res) => {
    const { USERID, message } = req.body;
    const SLACK_BOT_TOKEN = process.env.VITE_SLACK_BOT_USER_OAUTH_TOKEN;

    if (!SLACK_BOT_TOKEN) {
        return res.status(500).json({ error: "Slack Bot Token is missing!" });
    }

    try {
        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
            },
            body: JSON.stringify({
                channel: USERID, // Use the Slack User ID
                text: message,
            }),
        });

        const data = await response.json();

        if (!data.ok) throw new Error(data.error);

        return res.status(200).json({ success: true, message: "Notification sent successfully!" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});


//Sending Slack Notification On Request Reject
app.post("/send-slackreject", async (req, res) => {
    const { USERID, message } = req.body;
    const SLACK_BOT_TOKEN = process.env.VITE_SLACK_BOT_USER_OAUTH_TOKEN;

    if (!SLACK_BOT_TOKEN) {
        return res.status(500).json({ error: "Slack Bot Token is missing!" });
    }

    try {
        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
            },
            body: JSON.stringify({
                channel: USERID, // Use the Slack User ID
                text: message,
            }),
        });

        const data = await response.json();

        if (!data.ok) throw new Error(data.error);

        return res.status(200).json({ success: true, message: "Notification sent successfully!" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// Send Daily Log message to Slack
app.post("/send-dailylog-slack", async (req, res) => {
    const { USERID, message, userName } = req.body;
    const SLACK_BOT_TOKEN = process.env.VITE_SLACK_BOT_USER_OAUTH_TOKEN;

    if (!SLACK_BOT_TOKEN) {
        return res.status(500).json({ error: "Slack Bot Token is missing!" });
    }

    if (!USERID || !message) {
        return res.status(400).json({ error: "USERID and message are required!" });
    }

    try {
        console.log("🔍 Debug Info:");
        console.log("📋 USERID (slack_id):", USERID);
        console.log("👤 userName:", userName);
        console.log("📝 message:", message);
        console.log("🔑 Bot Token (first 10 chars):", SLACK_BOT_TOKEN.substring(0, 10) + "...");

        // Use dailylogs channel ID instead of user DM
        const channelId = "C05TPM3SH8X"; // Your dailylogs channel ID
        const formattedMessage = `📝 *Daily Log from ${userName || 'Employee'}* (User: <@${USERID}>)\n\n${message}`;

        console.log("📢 Sending to channel ID:", channelId);

        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
            },
            body: JSON.stringify({
                channel: channelId, // Use dailylogs channel ID
                text: formattedMessage,
            }),
        });

        const data = await response.json();
        console.log("📡 Full Slack API Response:", JSON.stringify(data, null, 2));

        if (!data.ok) {
            console.log("❌ Slack API Error Details:");
            console.log("   Error:", data.error);
            console.log("   Channel ID:", channelId);
            console.log("   Full Response:", data);

            // Check for specific errors
            if (data.error === 'not_in_channel') {
                console.log("🚨 Bot is not in the channel! Add the bot to the dailylogs channel.");
            } else if (data.error === 'channel_not_found') {
                console.log("🚨 Channel not found! Check if the channel ID is correct.");
            } else if (data.error === 'invalid_auth') {
                console.log("🚨 Invalid authentication! Check your bot token.");
            }

            throw new Error(data.error);
        }

        return res.status(200).json({ success: true, message: "Daily log sent to Slack successfully!" });
    } catch (error) {
        console.error("Error sending daily log to Slack:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to check user slack_id
app.get("/debug-users-slack", async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, full_name, email, slack_id')
            .not('slack_id', 'is', null);

        if (error) throw error;

        return res.status(200).json({
            success: true,
            users: users.map(user => ({
                ...user,
                slack_id_length: user.slack_id?.length,
                slack_id_trimmed: user.slack_id?.trim(),
                slack_id_raw: `'${user.slack_id}'`
            }))
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Fix slack_id whitespace in database
app.post("/fix-slack-ids", async (req, res) => {
    try {
        console.log("🔧 Fixing slack_id whitespace in database...");

        const { data: users, error: fetchError } = await supabase
            .from('users')
            .select('id, slack_id')
            .not('slack_id', 'is', null);

        if (fetchError) throw fetchError;

        const updates = [];
        for (const user of users) {
            if (user.slack_id && user.slack_id !== user.slack_id.trim()) {
                console.log(`Fixing user ${user.id}: '${user.slack_id}' -> '${user.slack_id.trim()}'`);

                const { error: updateError } = await supabase
                    .from('users')
                    .update({ slack_id: user.slack_id.trim() })
                    .eq('id', user.id);

                if (updateError) {
                    console.error(`Error updating user ${user.id}:`, updateError);
                } else {
                    updates.push({ id: user.id, old: user.slack_id, new: user.slack_id.trim() });
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: `Fixed ${updates.length} slack_id entries`,
            updates
        });
    } catch (error) {
        console.error("Error fixing slack_ids:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Test endpoint to find your Slack User ID
app.post("/test-slack-user", async (req, res) => {
    const { testUserId } = req.body;
    const SLACK_BOT_TOKEN = process.env.VITE_SLACK_BOT_USER_OAUTH_TOKEN;

    if (!SLACK_BOT_TOKEN) {
        return res.status(500).json({ error: "Slack Bot Token is missing!" });
    }

    try {
        console.log("🧪 Testing Slack User ID:", testUserId);

        const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
            },
            body: JSON.stringify({
                channel: testUserId,
                text: "🧪 Test message - if you receive this, your Slack ID is correct!",
            }),
        });

        const data = await response.json();
        console.log("🧪 Test Response:", JSON.stringify(data, null, 2));

        if (data.ok) {
            return res.status(200).json({
                success: true,
                message: "Test message sent successfully! Check your Slack DMs.",
                slackResponse: data
            });
        } else {
            return res.status(400).json({
                success: false,
                error: data.error,
                message: `Failed to send test message: ${data.error}`,
                slackResponse: data
            });
        }
    } catch (error) {
        console.error("🧪 Test Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Test endpoint to check if webhook is working
app.get("/test-webhook", (req, res) => {
    console.log("🧪 Test webhook endpoint called");
    res.json({ message: "Webhook endpoint is working!", timestamp: new Date().toISOString() });
});

// API endpoint to get ALL Slack messages for a user (not limited to current month)
app.post("/api/get-slack-messages", async (req, res) => {
    try {
        const { userId, channelId } = req.body;
        const SLACK_BOT_TOKEN = process.env.VITE_SLACK_BOT_USER_OAUTH_TOKEN;

        if (!SLACK_BOT_TOKEN) {
            return res.status(500).json({ error: "Slack Bot Token is missing!" });
        }

        if (!userId || !channelId) {
            return res.status(400).json({ error: "userId and channelId are required!" });
        }

        console.log("� Fetching ALL Slack messages for user:", userId, "in channel:", channelId);

        let allUserMessages = [];
        let cursor = null;
        let hasMore = true;
        let totalFetched = 0;

        // Fetch all messages using pagination
        while (hasMore && totalFetched < 1000) { // Limit to prevent infinite loops
            try {
                // Build URL with cursor for pagination
                let url = `https://slack.com/api/conversations.history?channel=${channelId}&limit=200`;
                if (cursor) {
                    url += `&cursor=${cursor}`;
                }

                console.log("📡 Fetching batch with cursor:", cursor ? cursor.substring(0, 20) + "..." : "none");

                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                });

                const data = await response.json();

                if (!data.ok) {
                    console.error("Slack API Error:", data.error);
                    return res.status(500).json({ error: data.error });
                }

                console.log(`📱 Fetched ${data.messages?.length || 0} messages in this batch`);
                totalFetched += data.messages?.length || 0;

                // Filter messages from the specific user (exclude bot messages)
                const batchUserMessages = data.messages?.filter(msg => {
                    return msg.user === userId.trim() &&
                        !msg.bot_id &&
                        msg.type === 'message' &&
                        msg.text && msg.text.trim().length > 0; // Only include messages with actual content
                }) || [];

                console.log(`📱 Found ${batchUserMessages.length} user messages in this batch`);
                allUserMessages = allUserMessages.concat(batchUserMessages);

                // Check if there are more messages
                hasMore = data.has_more || false;
                cursor = data.response_metadata?.next_cursor || null;

                // Add a small delay to avoid rate limiting
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

            } catch (batchError) {
                console.error("Error fetching batch:", batchError);
                break; // Exit the loop on error
            }
        }

        console.log(`📱 Total messages fetched: ${totalFetched}`);
        console.log(`📱 Total user messages found: ${allUserMessages.length}`);

        // Sort messages by timestamp (newest first)
        allUserMessages.sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts));

        if (allUserMessages.length > 0) {
            console.log("📱 Sample user message:", {
                text: allUserMessages[0].text?.substring(0, 100) + "...",
                timestamp: new Date(parseFloat(allUserMessages[0].ts) * 1000).toISOString()
            });
        }

        return res.status(200).json({
            success: true,
            messages: allUserMessages,
            total: allUserMessages.length,
            totalFetched: totalFetched
        });

    } catch (error) {
        console.error("Error fetching Slack messages:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Slack webhook for URL verification only (messages are fetched via API instead)
app.post("/slack-webhook", async (req, res) => {
    try {
        console.log("🚀 SLACK WEBHOOK RECEIVED!");
        console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

        // Handle Slack URL verification challenge
        if (req.body.type === 'url_verification') {
            console.log("✅ URL verification challenge received");
            return res.status(200).json({ challenge: req.body.challenge });
        }

        // Just acknowledge other events without processing
        if (req.body.type === 'event_callback') {
            console.log("📨 Event callback received - acknowledging without processing");
            return res.status(200).json({ status: 'ok' });
        }

        return res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Error handling Slack webhook:', error);
        return res.status(500).json({ error: error.message });
    }
});




// Function to send Checkin And CheckOut Reminders On Slack
const sendSlackNotification = async (message) => {
    const SLACK_WEBHOOK_URL = process.env.VITE_SLACK_WEBHOOK_URL; // Add this inside the function

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


// Schedule tasks using cron
cron.schedule("45 8 * * *", () => {
    sendSlackNotification("🌞 Good Morning! Please Don't Forget To Check In.");
}, {
    timezone: "Asia/Karachi"
});

cron.schedule("45 16 * * *", () => {
    sendSlackNotification("Hello Everyone! Ensure You Have Checked Out From EMS.");
}, {
    timezone: "Asia/Karachi"
});

cron.schedule("45 12 * * *", () => {
    sendSlackNotification("🔔 Reminder: Please Dont Forget To start Break!");
}, {
    timezone: "Asia/Karachi"
});

cron.schedule("45 13 * * *", () => {
    sendSlackNotification("🔔 Reminder: Please Dont Forget To End Break!");
}, {
    timezone: "Asia/Karachi"
});




// Email sending function
const sendEmail = async (req, res) => {
    const { senderEmail, recipientEmail, subject, employeeName, leaveType, startDate, endDate, reason } = req.body;

    // Create transporter
    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.VITE_EMAIL_USER, // Your email (EMS system email)
            pass: process.env.VITE_EMAIL_PASS, // Your app password
        },
    });

    let message = `
    <p>Dear <strong>Admin</strong>,</p>

    <p>A new leave request has been submitted.</p>

    <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;"><strong>Employee Name:</strong></td>
            <td style="border: 1px solid #ddd; padding: 8px;">${employeeName}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;"><strong>Leave Type:</strong></td>
            <td style="border: 1px solid #ddd; padding: 8px;">${leaveType}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;"><strong>Start Date:</strong></td>
            <td style="border: 1px solid #ddd; padding: 8px;">${startDate}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;"><strong>End Date:</strong></td>
            <td style="border: 1px solid #ddd; padding: 8px;">${endDate}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;"><strong>Reason:</strong></td>
            <td style="border: 1px solid #ddd; padding: 8px;">${reason}</td>
        </tr>
    </table>

    <p>Please review and take necessary action.</p>

    <p>Best Regards, <br> <strong>TechCreator EMS System</strong></p>
    `;

    // Email options
    let mailOptions = {
        from: process.env.VITE_EMAIL_USER, // The email that actually sends the email
        to: recipientEmail, // Admin's email
        subject: subject,
        html: message,
        replyTo: senderEmail, // This ensures the admin’s reply goes to the user
    };

    // Send email
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.response);
        res.status(200).json({ message: "Email sent successfully!" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send email" });
    } sendEmail
};
// API Route
app.post("/send-email", sendEmail);



//Sending Bulk Email To Users On Office Alerts
// Route: Send bulk email
app.post("/send-alertemail", async (req, res) => {
    const { recipients, subject, message } = req.body;

    if (!recipients || recipients.length === 0) {
        return res.status(400).json({ error: "Recipient list is empty" });
    }

    try {
        // Setup transporter
        const transporter = nodemailer.createTransport({
            service: "gmail", // or another provider
            auth: {
                user: process.env.VITE_EMAIL_USER, // Your email (EMS system email)
                pass: process.env.VITE_EMAIL_PASS, // Your app password
            },
        });

        // Send email
        const info = await transporter.sendMail({
            from: process.env.VITE_EMAIL_USER, // The email that actually sends the email
            to: "", // empty TO
            bcc: recipients, // list of emails
            subject,
            text: message, // or use html: "<b>Hello</b>"
        });

        console.log("Message sent: %s", info.messageId);
        res.json({ status: "Emails sent successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send emails", detail: error.message });
    }
});


const sendAdminResponse = async (req, res) => {
    const { employeeName, userEmail, leaveType, startDate } = req.body;

    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.VITE_EMAIL_USER, // EMS system email
            pass: process.env.VITE_EMAIL_PASS, // App password
        },
    });


    let message = `
    <p>Dear <strong>${employeeName}</strong>,</p>

    <p>Your leave request has been <strong style="color: green;">Approved</strong>.</p>

    <p><strong>Leave Details:</strong></p>
    <ul>
        <li><strong>Leave Type:</strong> ${leaveType}</li>
        <li><strong>Start Date:</strong> ${startDate}</li>
        <li><strong>End Date:</strong> ${startDate}</li>
    </ul>

    <p>Enjoy your time off, and please reach out if you have any questions.</p>

    <p>Best Regards, <br> <strong>TechCreator HR Team</strong></p>
    `;


    let mailOptions = {
        from: process.env.VITE_EMAIL_USER,
        to: userEmail,
        subject: "Leave Request Approved",
        html: message, // Using HTML format for better styling
        replyTo: "contact@techcreator.co",
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log("Response Email sent: " + info.response);
        res.status(200).json({ message: "Response email sent successfully!" });
    } catch (error) {
        console.error("Error sending response email:", error);
        res.status(500).json({ error: "Failed to send response email" });
    }
};

app.post("/send-response", sendAdminResponse);





//Sending Response To user For Rejected Requests

const sendAdminResponsereject = async (req, res) => {
    const { employeeName, userEmail, leaveType, startDate } = req.body;

    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.VITE_EMAIL_USER, // EMS system email
            pass: process.env.VITE_EMAIL_PASS, // App password
        },
    });

    let message = `
    <p>Dear <strong>${employeeName}</strong>,</p>

    <p>We regret to inform you that your leave request has been <strong style="color: red;">rejected</strong>.</p>

    <p><strong>Leave Details:</strong></p>
    <ul>
        <li><strong>Leave Type:</strong> ${leaveType}</li>
        <li><strong>Start Date:</strong> ${startDate}</li>
        <li><strong>End Date:</strong> ${startDate}</li>
    </ul>

    <p>If you have any concerns, please contact HR.</p>

    <p>Best Regards, <br> <strong>TechCreator HR Team</strong></p>
    `;

    let mailOptions = {
        from: process.env.VITE_EMAIL_USER,
        to: userEmail,
        subject: "Leave Request Rejected",
        html: message, // Send as HTML email
        replyTo: "contact@techcreator.co",
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log("Rejection Email sent: " + info.response);
        res.status(200).json({ message: "Rejection email sent successfully!" });
    } catch (error) {
        console.error("Error sending rejection email:", error);
        res.status(500).json({ error: "Failed to send rejection email" });
    }
};

app.post("/send-rejectresponse", sendAdminResponsereject);






//Path To Download Daily Attendance Data PDF
app.post('/generate-pdfDaily', (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Daily Attendance Report</h1>
        <table>
            <thead>
                <tr>
                    <th>Employee Name</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Work Mode</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.full_name}</td>
                        <td>${item.check_in}</td>
                        <td>${item.check_out}</td>
                        <td>${item.work_mode}</td>
                        <td>${item.status}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename); // Delete file after sending
        });
    });
});




//Path To Download Weekly Attendance Data PDF
app.post('/generate-pdfWeekly', (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Weekly Attendance Report</h1>
        <table>
            <thead>
                <tr>
                    <th>Employee Name</th>
                    <th>Attendance</th>
                    <th>Absentees</th>
                    <th>Working Hours</th>
                    <th>Working Hours %</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.user.full_name}</td>
                        <td>${item.presentDays}</td>
                        <td>${item.absentDays}</td>
                        <td>${item.totalHoursWorked.toFixed(2)}</td>
                        <td>${item.workingHoursPercentage.toFixed(2)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename); // Delete file after sending
        });
    });
});





//Path To Download Filtered Attendance Data PDF
app.post('/generate-Filtered', (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Attendance Report filtered</h1>
        <table>
            <thead>
                <tr>
                    <th>Employee Name</th>
                    <th>Attendance</th>
                    <th>Absentees</th>
                    <th>Working Hours</th>
                    <th>Working Hours %</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.user.full_name}</td>
                        <td>${item.presentDays}</td>
                        <td>${item.absentDays}</td>
                        <td>${item.totalHoursWorked.toFixed(2)}</td>
                        <td>${item.workingHoursPercentage.toFixed(2)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename); // Delete file after sending
        });
    });
});




//Path To Download Weekly Attendance Data PDF
app.post('/generate-pdfMonthly', (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Monthly Attendance Report</h1>
        <table>
            <thead>
                <tr>
                    <th>Employee Name</th>
                    <th>Attendance</th>
                    <th>Absentees</th>
                    <th>Working Hours</th>
                    <th>Working Hours %</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.user.full_name}</td>
                        <td>${item.presentDays}</td>
                        <td>${item.absentDays}</td>
                        <td>${item.totalHoursWorked.toFixed(2)}</td>
                        <td>${item.workingHoursPercentage.toFixed(2)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename); // Delete file after sending
        });
    });
});





//Path To Download Weekly Attendance Data PDF
app.post('/generate-pdfFilteredOfEmployee', (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Filtered Attendance Report of ${req.body.data[0].fullname}</h1>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Mode</th>


                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.date}</td>
                        <td>${item.status}</td>
                        <td>${item.Check_in}</td>
                        <td>${item.Check_out}</td>
                        <td>${item.workmode}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename); // Delete file after sending
        });
    });
});


//Path To Download Weekly Attendance Data PDF
app.post('/generate-pdfWeeklyOfEmployee', (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Weekly Attendance Report of ${req.body.data[0].fullname}</h1>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Mode</th>


                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.date}</td>
                        <td>${item.status}</td>
                        <td>${item.Check_in}</td>
                        <td>${item.Check_out}</td>
                        <td>${item.workmode}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename); // Delete file after sending
        });
    });
});

//Path To Download Monthly Attendance Data PDF
app.post('/generate-pdfMonthlyOfEmployee', (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Monthly Attendance Report of ${req.body.data[0].fullname} </h1>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Mode</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.date}</td>
                        <td>${item.status}</td>
                        <td>${item.Check_in}</td>
                        <td>${item.Check_out}</td>
                        <td>${item.workmode}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename); // Delete file after sending
        });
    });
});



// Add these functions from fetchusers.js
const holidaydates = [];

const isWorkingDay = (date) => {
    const day = date.getDay(); // Get the day of the week (0 = Sunday, 6 = Saturday)
    const dateStr = date.toISOString().split('T')[0];
    if (holidaydates.includes(dateStr)) {
        return false;
    }
    return day !== 0 && day !== 6; // Return true if it's not Saturday or Sunday
};

async function fetchholidays() {
    const { data, error } = await supabase
        .from('holidays')
        .select('date'); // Adjust to select the date field from your holidays table

    if (error) {
        console.error('Error fetching holidays:', error);
        return;
    }

    for (const holiday of data) {
        const convertedDate = new Date(holiday.date);
        const dateStr = convertedDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'

        if (!holidaydates.includes(dateStr)) {
            holidaydates.push(dateStr);
        }
    }
}

const fetchUsers = async () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    if (!isWorkingDay(today) || holidaydates.includes(dateStr)) {
        console.log('Today is not a working day or is a holiday. Skipping fetchUsers.');
        return;
    }

    try {
        console.log('Fetching users...');

        // Get today's date range
        const todayDate = today.toISOString().split('T')[0];
        const startOfDay = `${todayDate}T00:00:00.000Z`;
        const endOfDay = `${todayDate}T23:59:59.999Z`;

        // Fetch all users
        const { data: users, error: usersError } = await supabase.from('users').select('*');
        if (usersError) throw usersError;

        console.log(`Total users fetched: ${users.length}`);

        // Fetch all today's attendance records
        const { data: attendanceLogs, error: attendanceError } = await supabase
            .from('attendance_logs')
            .select('*')
            .gte('check_in', startOfDay)
            .lt('check_in', endOfDay);
        if (attendanceError) throw attendanceError;

        // Fetch all today's absentee records
        const { data: absentees, error: absenteeError } = await supabase
            .from('absentees')
            .select('*')
            .gte('created_at', startOfDay)
            .lt('created_at', endOfDay);
        if (absenteeError) throw absenteeError;

        // Arrays to store updates
        let attendanceUpdates = []; // For updating checkout times in attendance_logs
        let absenteeRecords = [];   // For inserting absentee records into absentees

        // Loop through each user
        for (const user of users) {
            console.log(`Processing user: ${user.id}`);

            // Find user's attendance for today
            const userAttendance = attendanceLogs.find(log => log.user_id === user.id);

            // Check if the user is already marked absent
            const existingAbsentee = absentees.find(absent => absent.user_id === user.id);

            // Case 1: User has NO check-in record
            if (!userAttendance) {
                console.log(`User ${user.id} has no check-in record.`);

                if (existingAbsentee) {
                    console.log(`User ${user.id} is already marked absent. Skipping...`);
                    continue;
                }

                console.log(`Marking user ${user.id} as absent for Full Day.`);
                absenteeRecords.push({ user_id: user.id, absentee_type: 'Absent', absentee_Timing: 'Full Day' });
                continue;
            }

            // Case 2: User has check-in but no check-out
            if (userAttendance.check_in && !userAttendance.check_out) {
                console.log(`User ${user.id} has checked in but no check-out.`);

                // Set the checkout time to 4:30 PM PKT (11:30 AM UTC)
                const checkoutTime = `${todayDate}T11:30:00.000Z`;

                // Add to attendanceUpdates array
                attendanceUpdates.push({
                    id: userAttendance.id, // Unique ID of the attendance record
                    check_out: checkoutTime, // New checkout time
                    autocheckout: 'yes' // Mark as auto-checkout
                });

                console.log(`User ${user.id} checkout time will be updated to 4:30 PM PKT.`);
                continue;
            }

            // Case 3: User has both check-in and check-out (No action needed)
            if (userAttendance.check_in && userAttendance.check_out) {
                console.log(`User ${user.id} has both check-in and check-out. No action needed.`);
                absenteeRecords.push({ user_id: user.id, absentee_type: 'Not Absent' });
                continue;
            }
        }

        // Remove duplicate entries based on user_id for absentee records
        const uniqueAbsenteeRecords = [];
        const seenUserIds = new Set();

        absenteeRecords.forEach(record => {
            if (!seenUserIds.has(record.user_id)) {
                seenUserIds.add(record.user_id);
                uniqueAbsenteeRecords.push(record);
            }
        });

        // Remove 'Not Absent' users and create a new array
        const finalAbsentees = uniqueAbsenteeRecords.filter(record => record.absentee_type !== 'Not Absent');

        // Log final absent users
        console.log('Final Absent Users Data:', finalAbsentees);

        // Perform batch updates for attendance logs
        if (attendanceUpdates.length > 0) {
            console.log('Updating attendance logs with checkout times...');
            for (const update of attendanceUpdates) {
                const { error: updateError } = await supabase
                    .from('attendance_logs')
                    .update({ check_out: update.check_out, autocheckout: 'yes' })
                    .eq('id', update.id);

                if (updateError) {
                    console.error('Error updating attendance log:', updateError);
                } else {
                    console.log(`Updated attendance log for user ${update.id}.`);
                }
            }
            console.log('Attendance logs updated successfully.');
        } else {
            console.log('No attendance logs to update.');
        }

        // Insert absentee records into the database
        if (finalAbsentees.length > 0) {
            console.log('Inserting absentee records into the database...');
            const { error: insertError } = await supabase.from('absentees').insert(finalAbsentees);
            if (insertError) throw insertError;
            console.log('Database updated successfully with absent users.');
        } else {
            console.log('No absent users to update in the database.');
        }
    } catch (error) {
        console.error('Error fetching users:', error);
    }
};

// Schedule fetchUsers to run at 9:00 PM PKT daily
cron.schedule('0 21 * * *', async () => {
    console.log('Running fetchUsers cron job at 9:00 PM PKT...');
    await fetchholidays(); // Fetch holidays before running fetchUsers
    await fetchUsers();
}, {
    timezone: 'Asia/Karachi'
});

// ... (Rest of your existing server.js code, including app.listen, remains unchanged)

// Start the Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Daily Logs Slack endpoint: http://localhost:${PORT}/send-dailylog-slack`);
    console.log(`🔗 Slack webhook endpoint: http://localhost:${PORT}/slack-webhook`);
    console.log(`🔥 Firebase Admin SDK: ${firebaseInitialized ? '✅ Enabled' : '⚠️ Disabled'}`);
    console.log(`📡 Server ready for Slack integration!`);
});
