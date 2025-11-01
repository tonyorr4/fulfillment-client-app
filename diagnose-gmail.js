const nodemailer = require('nodemailer');
require('dotenv').config();

async function diagnoseGmail() {
    console.log('🔍 Gmail SMTP Diagnostic Tool\n');
    console.log('='.repeat(60));

    // Check environment variables
    console.log('\n1. Environment Variables Check:');
    console.log('   GMAIL_USER:', process.env.GMAIL_USER ? '✓ SET' : '❌ MISSING');
    console.log('   Value:', process.env.GMAIL_USER || 'NOT SET');
    console.log('   GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✓ SET' : '❌ MISSING');
    if (process.env.GMAIL_APP_PASSWORD) {
        const cleanPassword = process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '');
        console.log('   Length:', cleanPassword.length, 'characters', cleanPassword.length === 16 ? '✓ CORRECT' : '❌ SHOULD BE 16');
        console.log('   Format:', /^[a-z]{16}$/.test(cleanPassword) ? '✓ Valid lowercase letters' : '⚠️  Expected 16 lowercase letters');
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.log('\n❌ Gmail credentials are not configured!');
        console.log('\n📋 To fix this in Railway:');
        console.log('   1. Go to your Railway project dashboard');
        console.log('   2. Click on your service');
        console.log('   3. Go to "Variables" tab');
        console.log('   4. Add these variables:');
        console.log('      - GMAIL_USER: your-email@gmail.com');
        console.log('      - GMAIL_APP_PASSWORD: your-16-char-app-password');
        console.log('\n📖 To generate a Gmail App Password:');
        console.log('   1. Go to https://myaccount.google.com/security');
        console.log('   2. Enable 2-Factor Authentication if not already enabled');
        console.log('   3. Go to https://myaccount.google.com/apppasswords');
        console.log('   4. Create a new app password for "Mail"');
        console.log('   5. Copy the 16-character password (no spaces)');
        process.exit(1);
    }

    // Test SMTP connection
    console.log('\n2. SMTP Connection Test:');
    console.log('   Creating transporter...');

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '')
        },
        connectionTimeout: 10000, // 10 second timeout
        greetingTimeout: 10000
    });

    try {
        console.log('   Attempting to verify connection...');
        console.log('   (This may take up to 10 seconds)');

        await transporter.verify();

        console.log('   ✅ SUCCESS! Gmail SMTP connection verified!');
        console.log('\n3. Sending Test Email:');

        const testResult = await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: 'Test Email from Sincro Fulfillment',
            text: 'This is a test email to verify Gmail SMTP is working correctly.',
            html: '<p>This is a test email to verify Gmail SMTP is working correctly.</p>'
        });

        console.log('   ✅ Test email sent successfully!');
        console.log('   Message ID:', testResult.messageId);
        console.log('\n✅ All checks passed! Gmail is configured correctly.');

    } catch (error) {
        console.log('   ❌ Connection failed!');
        console.log('\nError Details:');
        console.log('   Type:', error.name);
        console.log('   Message:', error.message);
        console.log('   Code:', error.code || 'N/A');

        console.log('\n🔧 Troubleshooting Steps:');

        if (error.message.includes('timeout') || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
            console.log('   ❌ Connection Timeout - This usually means:');
            console.log('      1. Railway\'s network can\'t reach Gmail SMTP (port 587/465 blocked)');
            console.log('      2. Gmail is blocking Railway\'s IP addresses');
            console.log('      3. Firewall or security rules blocking outbound SMTP');
            console.log('\n   💡 Recommended Solutions:');
            console.log('      Option A: Use a transactional email service instead:');
            console.log('         - SendGrid (free tier: 100 emails/day)');
            console.log('         - Mailgun (free tier: 5000 emails/month)');
            console.log('         - AWS SES (very cheap, reliable)');
            console.log('      Option B: Use Railway\'s SMTP add-on if available');
            console.log('      Option C: Disable email notifications (not recommended)');
        } else if (error.message.includes('authentication') || error.message.includes('credentials')) {
            console.log('   ❌ Authentication Failed - Check:');
            console.log('      1. App password is correct (16 lowercase letters)');
            console.log('      2. 2FA is enabled on your Google account');
            console.log('      3. App password hasn\'t been revoked');
            console.log('      4. Using the Gmail account email, not an alias');
        } else if (error.message.includes('Invalid login')) {
            console.log('   ❌ Invalid Login - This means:');
            console.log('      1. The GMAIL_USER email is incorrect');
            console.log('      2. The app password is incorrect');
            console.log('      3. 2FA is not enabled on the Google account');
        }

        console.log('\n📚 Additional Resources:');
        console.log('   - Gmail App Passwords: https://support.google.com/accounts/answer/185833');
        console.log('   - Railway Environment Variables: https://docs.railway.app/develop/variables');

        process.exit(1);
    }
}

diagnoseGmail().catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
});
