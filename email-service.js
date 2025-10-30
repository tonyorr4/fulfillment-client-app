const brevo = require('@getbrevo/brevo');
require('dotenv').config();

/**
 * Send email notification using Brevo
 * @param {Object} emailData - Email details
 */
async function sendEmail(emailData) {
    // Check if Brevo API key is configured
    if (!process.env.BREVO_API_KEY) {
        console.warn('Brevo API key not configured. Skipping email.');
        return { success: false, message: 'Brevo API key not configured' };
    }

    try {
        // Initialize API client
        const apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(
            brevo.TransactionalEmailsApiApiKeys.apiKey,
            process.env.BREVO_API_KEY
        );

        // Create email object
        const sendSmtpEmail = new brevo.SendSmtpEmail();

        sendSmtpEmail.subject = emailData.subject;
        sendSmtpEmail.htmlContent = emailData.htmlContent;
        sendSmtpEmail.textContent = emailData.textContent;

        sendSmtpEmail.sender = {
            name: emailData.senderName || 'Sincro Fulfillment',
            email: process.env.BREVO_SENDER_EMAIL
        };

        sendSmtpEmail.to = [
            {
                email: emailData.recipientEmail,
                name: emailData.recipientName
            }
        ];

        sendSmtpEmail.replyTo = {
            email: process.env.BREVO_SENDER_EMAIL
        };

        // Send email
        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

        console.log('Email sent successfully:', result.messageId);
        return {
            success: true,
            messageId: result.messageId,
            message: 'Email sent successfully'
        };

    } catch (error) {
        console.error('Error sending email:', error);
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
async function sendNewRequestNotification(requestData) {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0052cc; border-bottom: 2px solid #0052cc; padding-bottom: 10px;">
                New Fulfillment Request
            </h2>

            <div style="background-color: #f4f5f7; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Client Name:</strong> ${requestData.client_name}</p>
                <p><strong>Client ID:</strong> ${requestData.client_id}</p>
                <p><strong>Client Type:</strong> ${requestData.client_type}</p>
                <p><strong>Avg Orders/Month:</strong> ${requestData.avg_orders}</p>
                <p><strong>Est. Inbound Date:</strong> ${new Date(requestData.est_inbound_date).toLocaleDateString()}</p>
                <p><strong>Sales Team:</strong> ${requestData.sales_team}</p>
                <p><strong>Fulfillment Ops:</strong> ${requestData.fulfillment_ops}</p>
                ${requestData.auto_approved ? '<p style="color: #00875a; font-weight: bold;">✓ AUTO-APPROVED</p>' : '<p style="color: #ff991f; font-weight: bold;">⏳ Awaiting Review</p>'}
            </div>

            <div style="margin: 20px 0;">
                <a href="${process.env.APP_URL}"
                   style="display: inline-block; background-color: #0052cc; color: white;
                          padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                    View Request
                </a>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;
                        color: #666; font-size: 12px;">
                <p>This is an automated notification from Sincro Fulfillment.</p>
            </div>
        </div>
    `;

    const textContent = `
New Fulfillment Request

Client Name: ${requestData.client_name}
Client ID: ${requestData.client_id}
Client Type: ${requestData.client_type}
Avg Orders/Month: ${requestData.avg_orders}
Est. Inbound Date: ${new Date(requestData.est_inbound_date).toLocaleDateString()}
Sales Team: ${requestData.sales_team}
Fulfillment Ops: ${requestData.fulfillment_ops}
${requestData.auto_approved ? 'Status: AUTO-APPROVED' : 'Status: Awaiting Review'}

View at: ${process.env.APP_URL}
    `;

    return sendEmail({
        recipientEmail: process.env.ADMIN_NOTIFICATION_EMAIL,
        recipientName: 'Admin',
        subject: `New Fulfillment Request: ${requestData.client_name}`,
        htmlContent: htmlContent,
        textContent: textContent,
        senderName: 'Sincro Fulfillment'
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

module.exports = {
    sendEmail,
    sendMentionNotification,
    sendNewRequestNotification,
    sendClientSetupNotification
};
