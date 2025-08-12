import fetch from "node-fetch";
import { config } from "../config/environment.js";
import supabase from "../config/database.js";

// Send Slack notification on request approval
export const sendSlackApproval = async (req, res) => {
    const { USERID, message } = req.body;
    const SLACK_BOT_TOKEN = config.slack.botToken;

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
                channel: USERID,
                text: message,
            }),
        });

        const data = await response.json();

        if (!data.ok) throw new Error(data.error);

        return res.status(200).json({ success: true, message: "Notification sent successfully!" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Send Slack notification on request rejection
export const sendSlackRejection = async (req, res) => {
    const { USERID, message } = req.body;
    const SLACK_BOT_TOKEN = config.slack.botToken;

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
                channel: USERID,
                text: message,
            }),
        });

        const data = await response.json();

        if (!data.ok) throw new Error(data.error);

        return res.status(200).json({ success: true, message: "Notification sent successfully!" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Send Daily Log message to Slack
export const sendDailyLogSlack = async (req, res) => {
    const { USERID, message, userName } = req.body;
    const SLACK_BOT_TOKEN = config.slack.botToken;

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
                channel: channelId,
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
};

// Debug endpoint to check user slack_id
export const debugUsersSlack = async (req, res) => {
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
};

// Fix slack_id whitespace in database
export const fixSlackIds = async (req, res) => {
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
};

// Test endpoint to find your Slack User ID
export const testSlackUser = async (req, res) => {
    const { testUserId } = req.body;
    const SLACK_BOT_TOKEN = config.slack.botToken;

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
};

// Test endpoint to check if webhook is working
export const testWebhook = (req, res) => {
    console.log("🧪 Test webhook endpoint called");
    res.json({ message: "Webhook endpoint is working!", timestamp: new Date().toISOString() });
};

// API endpoint to get ALL Slack messages for a user
export const getSlackMessages = async (req, res) => {
    try {
        const { userId, channelId } = req.body;
        const SLACK_BOT_TOKEN = config.slack.botToken;

        if (!SLACK_BOT_TOKEN) {
            return res.status(500).json({ error: "Slack Bot Token is missing!" });
        }

        if (!userId || !channelId) {
            return res.status(400).json({ error: "userId and channelId are required!" });
        }

        console.log("📱 Fetching ALL Slack messages for user:", userId, "in channel:", channelId);

        let allUserMessages = [];
        let cursor = null;
        let hasMore = true;
        let totalFetched = 0;

        // Fetch all messages using pagination
        while (hasMore && totalFetched < 1000) {
            try {
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

                // Filter messages from the specific user
                const batchUserMessages = data.messages?.filter(msg => {
                    return msg.user === userId.trim() &&
                        !msg.bot_id &&
                        msg.type === 'message' &&
                        msg.text && msg.text.trim().length > 0;
                }) || [];

                console.log(`📱 Found ${batchUserMessages.length} user messages in this batch`);
                allUserMessages = allUserMessages.concat(batchUserMessages);

                hasMore = data.has_more || false;
                cursor = data.response_metadata?.next_cursor || null;

                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

            } catch (batchError) {
                console.error("Error fetching batch:", batchError);
                break;
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
};

// Slack webhook for URL verification
export const slackWebhook = async (req, res) => {
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
};
