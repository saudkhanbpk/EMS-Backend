import { createEmailTransporter } from "../config/email.js";
import { config } from "../config/environment.js";

// Send leave request email
export const sendEmail = async (req, res) => {
    const { senderEmail, recipientEmail, subject, employeeName, leaveType, startDate, endDate, reason } = req.body;

    // Create transporter
    const transporter = createEmailTransporter();

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
        from: config.email.user,
        to: recipientEmail,
        subject: subject,
        html: message,
        replyTo: senderEmail,
    };

    // Send email
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.response);
        res.status(200).json({ message: "Email sent successfully!" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send email" });
    }
};

// Send bulk alert email
export const sendAlertEmail = async (req, res) => {
    const { recipients, subject, message } = req.body;

    if (!recipients || recipients.length === 0) {
        return res.status(400).json({ error: "Recipient list is empty" });
    }

    try {
        const transporter = createEmailTransporter();

        const info = await transporter.sendMail({
            from: config.email.user,
            to: "",
            bcc: recipients,
            subject,
            text: message,
        });

        console.log("Message sent: %s", info.messageId);
        res.json({ status: "Emails sent successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send emails", detail: error.message });
    }
};

// Send admin approval response
export const sendAdminResponse = async (req, res) => {
    const { employeeName, userEmail, leaveType, startDate } = req.body;

    const transporter = createEmailTransporter();

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
        from: config.email.user,
        to: userEmail,
        subject: "Leave Request Approved",
        html: message,
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

// Send admin rejection response
export const sendAdminResponseReject = async (req, res) => {
    const { employeeName, userEmail, leaveType, startDate } = req.body;

    const transporter = createEmailTransporter();

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
        from: config.email.user,
        to: userEmail,
        subject: "Leave Request Rejected",
        html: message,
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
