const { google } = require('googleapis');
require('dotenv').config();

// Gmail API OAuth2 client
let gmailApiConfigured = false;
let oauth2Client = null;

// Initialize Gmail API with OAuth credentials
if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
    try {
        oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            'http://localhost:3000/oauth2callback'
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.GMAIL_REFRESH_TOKEN
        });

        gmailApiConfigured = true;
        console.log('✅ Gmail API (OAuth2) initialized for email delivery');
    } catch (error) {
        console.error('❌ Failed to initialize Gmail API:', error.message);
    }
} else {
    console.error('❌ Gmail API not configured! Missing OAuth2 credentials.');
    console.error('   Required: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
}

/**
 * Verify Gmail API connection
 */
async function verifyConnection() {
    if (!gmailApiConfigured || !oauth2Client) {
        console.error('⚠️ Gmail API not configured - cannot verify connection');
        return false;
    }

    console.log('🔍 Verifying Gmail API connection...');
    try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        await gmail.users.getProfile({ userId: 'me' });
        console.log('✅ Gmail API connection verified successfully!');
        console.log('   Email delivery via Gmail API (HTTPS)');
        return true;
    } catch (error) {
        console.error('❌ Gmail API connection verification failed!');
        console.error('   Error:', error.message);
        console.error('   Check OAuth credentials: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
        return false;
    }
}

/**
 * Send email using Gmail API (OAuth2)
 * @param {Object} emailData - Email details (recipientEmail, recipientName, subject, htmlContent, textContent, senderName)
 */
async function sendEmail(emailData) {
    // Check if Gmail API is configured
    if (!gmailApiConfigured || !oauth2Client) {
        console.error('❌ Gmail API not configured. Cannot send email.');
        return { success: false, message: 'Gmail API not configured' };
    }

    try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Create email in RFC 2822 format
        const from = `${emailData.senderName || 'Sincro Fulfillment'} <${process.env.GMAIL_USER}>`;
        const to = `${emailData.recipientName} <${emailData.recipientEmail}>`;

        const email = [
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${emailData.subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            emailData.htmlContent
        ].join('\r\n');

        // Encode email in base64url
        const encodedEmail = Buffer.from(email)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        console.log('📧 Sending email via Gmail API:');
        console.log('   To:', emailData.recipientEmail);
        console.log('   From:', process.env.GMAIL_USER);
        console.log('   Subject:', emailData.subject);

        // Send email using Gmail API
        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedEmail
            }
        });

        console.log('✉️ Email sent successfully via Gmail API');
        console.log('✉️ Message ID:', result.data.id);

        return {
            success: true,
            messageId: result.data.id,
            message: 'Email sent successfully'
        };

    } catch (error) {
        console.error('❌ Gmail API email failed:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Failed to send email'
        };
    }
}

/**
 * Send notification when user is mentioned in a comment
 */
async function sendMentionNotification(mentionedUser, commenter, clientName, commentText) {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0052cc; border-bottom: 2px solid #0052cc; padding-bottom: 10px;">
                You were mentioned in a comment
            </h2>

            <div style="background-color: #f4f5f7; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>${commenter}</strong> mentioned you in <strong>${clientName}</strong>:</p>
                <p style="font-style: italic; color: #172b4d; margin: 15px 0; padding: 10px; background-color: white; border-left: 3px solid #0052cc;">
                    "${commentText}"
                </p>
            </div>

            <div style="margin: 20px 0;">
                <a href="${process.env.APP_URL}"
                   style="display: inline-block; background-color: #0052cc; color: white;
                          padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                    View Client Details
                </a>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;
                        color: #666; font-size: 12px;">
                <p>This is an automated notification from Sincro Fulfillment.</p>
            </div>
        </div>
    `;

    const textContent = `
You were mentioned in a comment

${commenter} mentioned you in ${clientName}:
"${commentText}"

View at: ${process.env.APP_URL}
    `;

    return sendEmail({
        recipientEmail: mentionedUser.email,
        recipientName: mentionedUser.name,
        subject: `You were mentioned in ${clientName}`,
        htmlContent: htmlContent,
        textContent: textContent,
        senderName: 'Sincro Fulfillment'
    });
}

/**
 * Send notification when a new fulfillment request is created
 */
async function sendNewRequestNotification(requestData, salesTeamUser) {
    const statusText = requestData.auto_approved ? 'AUTO-APPROVED - Moved to Signing' : 'Pending Review';
    const statusColor = requestData.auto_approved ? '#00875a' : '#ff991f';

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0052cc; border-bottom: 2px solid #0052cc; padding-bottom: 10px;">
                Fulfillment Request ${requestData.auto_approved ? 'Auto-Approved' : 'Submitted'}
            </h2>

            <div style="background-color: ${statusColor}15; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${statusColor};">
                <p style="color: ${statusColor}; font-weight: bold; margin: 0;">
                    ${statusText}
                </p>
            </div>

            <div style="background-color: #f4f5f7; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Client Name:</strong> ${requestData.client_name}</p>
                <p><strong>Client ID:</strong> ${requestData.client_id}</p>
                <p><strong>Client Type:</strong> ${requestData.client_type}</p>
                <p><strong>Avg Orders/Month:</strong> ${requestData.avg_orders}</p>
                <p><strong>Est. Inbound Date:</strong> ${new Date(requestData.est_inbound_date).toLocaleDateString()}</p>
                <p><strong>Sales Team:</strong> ${requestData.sales_team}</p>
                <p><strong>Fulfillment Ops:</strong> ${requestData.fulfillment_ops}</p>
            </div>

            <div style="margin: 20px 0;">
                <a href="${process.env.APP_URL}"
                   style="display: inline-block; background-color: #0052cc; color: white;
                          padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                    View Client Tile
                </a>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;
                        color: #666; font-size: 12px;">
                <p>This is an automated notification from Sincro Fulfillment.</p>
            </div>
        </div>
    `;

    const textContent = `
Fulfillment Request ${requestData.auto_approved ? 'Auto-Approved' : 'Submitted'}

${statusText}

Client Name: ${requestData.client_name}
Client ID: ${requestData.client_id}
Client Type: ${requestData.client_type}
Avg Orders/Month: ${requestData.avg_orders}
Est. Inbound Date: ${new Date(requestData.est_inbound_date).toLocaleDateString()}
Sales Team: ${requestData.sales_team}
Fulfillment Ops: ${requestData.fulfillment_ops}

View at: ${process.env.APP_URL}
    `;

    // Send to sales team member if email provided
    if (salesTeamUser && salesTeamUser.email) {
        await sendEmail({
            recipientEmail: salesTeamUser.email,
            recipientName: salesTeamUser.name,
            subject: `Fulfillment Request ${requestData.auto_approved ? '[Auto-Approved]' : '[Pending Review]'} - ${requestData.client_name}`,
            htmlContent: htmlContent,
            textContent: textContent,
            senderName: 'Sincro Fulfillment'
        });
    }

    // Always notify Tony
    await notifyTony('new_request', requestData, {
        description: `${requestData.auto_approved ? 'Auto-approved and moved to Signing' : 'Submitted for manual review'}`
    });
}

/**
 * Send notification when client moves to Client Setup (with auto-subtasks)
 */
async function sendClientSetupNotification(clientData, salesTeam, fulfillmentOps) {
    const salesEmail = `${salesTeam.toLowerCase().replace(' ', '.')}@easyship.com`;
    const opsEmail = `${fulfillmentOps.toLowerCase().replace(' ', '.')}@easyship.com`;

    // Notify Sales Team
    const salesHtmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0052cc;">Client Moved to Setup Phase</h2>
            <p>Hi ${salesTeam},</p>
            <p>The client <strong>${clientData.client_name}</strong> has been moved to the Client Setup phase.</p>
            <p><strong>Your Task:</strong> Security deposit confirmation</p>
            <div style="margin: 20px 0;">
                <a href="${process.env.APP_URL}" style="display: inline-block; background-color: #0052cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                    View Client
                </a>
            </div>
        </div>
    `;

    // Notify Fulfillment Ops
    const opsHtmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0052cc;">Client Moved to Setup Phase</h2>
            <p>Hi ${fulfillmentOps},</p>
            <p>The client <strong>${clientData.client_name}</strong> has been moved to the Client Setup phase.</p>
            <p><strong>Your Task:</strong> WMS Setup (Client and billing parameters)</p>
            <div style="margin: 20px 0;">
                <a href="${process.env.APP_URL}" style="display: inline-block; background-color: #0052cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                    View Client
                </a>
            </div>
        </div>
    `;

    // Send both emails
    await sendEmail({
        recipientEmail: salesEmail,
        recipientName: salesTeam,
        subject: `Action Required: ${clientData.client_name} - Security Deposit`,
        htmlContent: salesHtmlContent,
        textContent: `Security deposit confirmation needed for ${clientData.client_name}`,
        senderName: 'Sincro Fulfillment'
    });

    await sendEmail({
        recipientEmail: opsEmail,
        recipientName: fulfillmentOps,
        subject: `Action Required: ${clientData.client_name} - WMS Setup`,
        htmlContent: opsHtmlContent,
        textContent: `WMS Setup needed for ${clientData.client_name}`,
        senderName: 'Sincro Fulfillment'
    });
}

/**
 * Notify Tony of any update to any client tile
 */
async function notifyTony(eventType, clientData, details = {}) {
    const tonyEmail = 'tony.orr@easyship.com';

    // Map event types to readable descriptions
    const eventDescriptions = {
        'new_request': `New Request Created`,
        'status_changed': `Status Changed to ${details.newStatus}`,
        'approval_decision': `Approval Decision: ${details.approval}`,
        'comment_added': `Comment Added`,
        'subtask_completed': `Subtask Completed`,
        'subtask_created': `New Subtask Created`,
        'assignment_changed': `Assignment Changed`
    };

    const eventDescription = eventDescriptions[eventType] || eventType;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0052cc; border-bottom: 2px solid #0052cc; padding-bottom: 10px;">
                ${eventDescription}
            </h2>

            <div style="background-color: #f4f5f7; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Client:</strong> ${clientData.client_name}</p>
                <p><strong>Client ID:</strong> ${clientData.client_id}</p>
                <p><strong>Status:</strong> ${clientData.status || 'N/A'}</p>
                ${details.description ? `<p><strong>Details:</strong> ${details.description}</p>` : ''}
            </div>

            <div style="margin: 20px 0;">
                <a href="${process.env.APP_URL}"
                   style="display: inline-block; background-color: #0052cc; color: white;
                          padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                    View Client
                </a>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;
                        color: #666; font-size: 12px;">
                <p>This is an automated notification from Sincro Fulfillment.</p>
            </div>
        </div>
    `;

    const textContent = `
${eventDescription}

Client: ${clientData.client_name}
Client ID: ${clientData.client_id}
Status: ${clientData.status || 'N/A'}
${details.description ? `Details: ${details.description}` : ''}

View at: ${process.env.APP_URL}
    `;

    return sendEmail({
        recipientEmail: tonyEmail,
        recipientName: 'Tony Orr',
        subject: `[Fulfillment] ${eventDescription} - ${clientData.client_name}`,
        htmlContent: htmlContent,
        textContent: textContent,
        senderName: 'Sincro Fulfillment'
    });
}

/**
 * Send notification for status changes
 */
async function sendStatusChangeNotification(clientData, oldStatus, newStatus) {
    // Notify Tony
    await notifyTony('status_changed', clientData, {
        newStatus: newStatus,
        description: `Status changed from ${oldStatus} to ${newStatus}`
    });
}

/**
 * Send notification for subtask completion
 */
async function sendSubtaskCompletionNotification(clientData, subtaskData, completedBy) {
    // Notify Tony
    await notifyTony('subtask_completed', clientData, {
        description: `"${subtaskData.subtask_text}" completed by ${completedBy.name}`
    });
}

/**
 * Send notification for approval decisions
 */
async function sendApprovalDecisionNotification(clientData, approval, decidedBy) {
    const approvalText = approval === 'yes' ? 'Approved' : approval === 'no' ? 'Rejected' : 'Auto-Approved';

    // Notify Tony
    await notifyTony('approval_decision', clientData, {
        approval: approvalText,
        description: `Approval decision: ${approvalText} by ${decidedBy.name}`
    });
}

module.exports = {
    sendEmail,
    verifyConnection,
    sendMentionNotification,
    sendNewRequestNotification,
    sendClientSetupNotification,
    notifyTony,
    sendStatusChangeNotification,
    sendSubtaskCompletionNotification,
    sendApprovalDecisionNotification
};
