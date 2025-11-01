# Alternative: Switch to SendGrid (If Gmail Still Fails)

If Gmail continues to timeout on Railway, use SendGrid instead. It's designed for cloud environments and has a free tier (100 emails/day).

## Setup Steps:

### 1. Create SendGrid Account
- Go to https://sendgrid.com/free/
- Sign up for free account
- Verify your email

### 2. Create API Key
- Go to Settings → API Keys
- Click "Create API Key"
- Name: "Sincro Fulfillment"
- Permissions: "Full Access" or just "Mail Send"
- Copy the API key (starts with "SG.")

### 3. Update Railway Environment Variables
Add to Railway Variables tab:
```
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=sincro-reply@gosincro.com
SENDGRID_FROM_NAME=Sincro Fulfillment
```

### 4. Install SendGrid Package
```bash
npm install @sendgrid/mail
```

### 5. Update email-service.js
Replace the nodemailer implementation with SendGrid:

```javascript
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✅ SendGrid initialized');
}

async function sendEmail(emailData) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn('SendGrid not configured. Skipping email.');
        return { success: false, message: 'SendGrid not configured' };
    }

    try {
        const msg = {
            to: {
                email: emailData.recipientEmail,
                name: emailData.recipientName
            },
            from: {
                email: process.env.SENDGRID_FROM_EMAIL || 'sincro-reply@gosincro.com',
                name: process.env.SENDGRID_FROM_NAME || 'Sincro Fulfillment'
            },
            subject: emailData.subject,
            text: emailData.textContent,
            html: emailData.htmlContent
        };

        console.log('📧 Sending email via SendGrid to:', emailData.recipientEmail);
        const result = await sgMail.send(msg);

        console.log('✉️ Email sent successfully via SendGrid');
        return {
            success: true,
            messageId: result[0].headers['x-message-id'],
            message: 'Email sent successfully'
        };

    } catch (error) {
        console.error('❌ SendGrid email failed:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Failed to send email'
        };
    }
}
```

## Benefits of SendGrid:
- ✅ Works reliably on Railway/cloud providers
- ✅ Better deliverability than Gmail
- ✅ Email analytics and tracking
- ✅ 100 emails/day free tier
- ✅ No SMTP port blocking issues

## Alternative Services:
- **Mailgun**: 5000 emails/month free
- **AWS SES**: ~$0.10 per 1000 emails
- **Resend**: 3000 emails/month free, modern API
