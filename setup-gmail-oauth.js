const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

async function setupGmailOAuth() {
    console.log('\n🔐 Gmail API OAuth2 Setup\n');
    console.log('='.repeat(60));

    // Check if credentials are in .env
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
        console.log('\n❌ Missing OAuth2 credentials in .env file!\n');
        console.log('Please add these to your .env file:');
        console.log('   GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com');
        console.log('   GMAIL_CLIENT_SECRET=GOCSPX-your-client-secret');
        console.log('   GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback');
        console.log('   GMAIL_USER=sincro-reply@gosincro.com\n');
        console.log('See GMAIL_API_SETUP.md for detailed instructions.\n');
        process.exit(1);
    }

    console.log('\n✅ Found OAuth2 credentials in .env');
    console.log('   Client ID:', process.env.GMAIL_CLIENT_ID.substring(0, 20) + '...');
    console.log('   Client Secret:', process.env.GMAIL_CLIENT_SECRET.substring(0, 15) + '...');

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        REDIRECT_URI
    );

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent' // Force to get refresh token
    });

    console.log('\n📋 Step 1: Authorize this app');
    console.log('='.repeat(60));
    console.log('\nOpen this URL in your browser:\n');
    console.log('\x1b[36m%s\x1b[0m', authUrl); // Cyan color
    console.log('\n1. Sign in with:', process.env.GMAIL_USER);
    console.log('2. Click "Continue" (ignore warning about unverified app)');
    console.log('3. Grant permissions');
    console.log('4. Copy the authorization code from the URL');
    console.log('   (Look for: localhost:3000/oauth2callback?code=YOUR_CODE)');

    // Get authorization code from user
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('\n📝 Paste the authorization code here: ', async (code) => {
        rl.close();

        try {
            console.log('\n🔄 Exchanging code for tokens...');

            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);

            if (!tokens.refresh_token) {
                console.log('\n❌ No refresh token received!');
                console.log('This usually means you already authorized this app before.');
                console.log('\nTo fix:');
                console.log('1. Go to https://myaccount.google.com/permissions');
                console.log('2. Remove "Sincro Fulfillment" app');
                console.log('3. Run this script again');
                process.exit(1);
            }

            console.log('\n✅ Successfully obtained tokens!');
            console.log('   Access Token:', tokens.access_token.substring(0, 20) + '...');
            console.log('   Refresh Token:', tokens.refresh_token.substring(0, 20) + '...');

            // Save refresh token to .env
            const envPath = path.join(__dirname, '.env');
            let envContent = fs.readFileSync(envPath, 'utf8');

            // Remove existing GMAIL_REFRESH_TOKEN if present
            envContent = envContent.split('\n').filter(line => !line.startsWith('GMAIL_REFRESH_TOKEN=')).join('\n');

            // Add new refresh token
            if (!envContent.endsWith('\n')) {
                envContent += '\n';
            }
            envContent += `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`;

            fs.writeFileSync(envPath, envContent);

            console.log('\n✅ Saved refresh token to .env file!');
            console.log('\n📋 Next Steps:');
            console.log('='.repeat(60));
            console.log('\n1. Add this to Railway environment variables:');
            console.log('\x1b[33m%s\x1b[0m', `   GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
            console.log('\n2. Also add these if not already present:');
            console.log(`   GMAIL_CLIENT_ID=${process.env.GMAIL_CLIENT_ID}`);
            console.log(`   GMAIL_CLIENT_SECRET=${process.env.GMAIL_CLIENT_SECRET}`);
            console.log(`   GMAIL_USER=${process.env.GMAIL_USER}`);
            console.log('\n3. Railway will auto-redeploy with the new variables');
            console.log('\n4. Test by creating a client in your app\n');

        } catch (error) {
            console.error('\n❌ Error getting tokens:', error.message);
            console.log('\nCommon issues:');
            console.log('   - Invalid authorization code (copy the entire code)');
            console.log('   - Code already used (get a new authorization URL)');
            console.log('   - Redirect URI mismatch (must be exactly: http://localhost:3000/oauth2callback)');
            process.exit(1);
        }
    });
}

setupGmailOAuth().catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
});
