/**
 * Slack Service
 * Handles Slack API integration for fetching channel messages
 */

const axios = require('axios');

const SLACK_API_BASE = 'https://slack.com/api';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

/**
 * Convert client name to expected Slack channel name format
 * Example: "Acme Corporation" -> "client-acme-corporation"
 */
function clientNameToChannelName(clientName) {
    return 'client-' + clientName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Remove duplicate hyphens
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Find Slack channel ID by name
 * @param {string} channelName - Channel name (without #)
 * @returns {Promise<string|null>} - Channel ID or null if not found
 */
async function findChannelByName(channelName) {
    try {
        console.log(`🔍 Searching for Slack channel: #${channelName}`);

        const response = await axios.get(`${SLACK_API_BASE}/conversations.list`, {
            headers: {
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                types: 'public_channel,private_channel',
                exclude_archived: true,
                limit: 1000
            }
        });

        if (!response.data.ok) {
            console.error('Slack API error:', response.data.error);
            return null;
        }

        const channel = response.data.channels.find(ch => ch.name === channelName);

        if (channel) {
            console.log(`✅ Found channel: #${channel.name} (ID: ${channel.id})`);
            return channel.id;
        } else {
            console.log(`❌ Channel #${channelName} not found`);
            return null;
        }

    } catch (error) {
        console.error('Error finding Slack channel:', error.message);
        return null;
    }
}

/**
 * Auto-match Slack channel for a client
 * @param {string} clientName - Client name
 * @returns {Promise<string|null>} - Channel ID or null if not found
 */
async function autoMatchChannel(clientName) {
    const expectedChannelName = clientNameToChannelName(clientName);
    return await findChannelByName(expectedChannelName);
}

/**
 * Fetch messages from Slack channel
 * @param {string} channelId - Slack channel ID
 * @param {string|null} oldestTimestamp - Optional: only fetch messages after this timestamp
 * @param {number} limit - Max messages to fetch (default 1000)
 * @returns {Promise<Array>} - Array of message objects
 */
async function fetchChannelMessages(channelId, oldestTimestamp = null, limit = 1000) {
    try {
        console.log(`📥 Fetching messages from channel ${channelId}${oldestTimestamp ? ' since ' + oldestTimestamp : ''}`);

        const params = {
            channel: channelId,
            limit: limit
        };

        if (oldestTimestamp) {
            params.oldest = oldestTimestamp;
        }

        const response = await axios.get(`${SLACK_API_BASE}/conversations.history`, {
            headers: {
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: params
        });

        if (!response.data.ok) {
            console.error('Slack API error:', response.data.error);
            return [];
        }

        const messages = response.data.messages || [];
        console.log(`✅ Fetched ${messages.length} messages`);

        // Filter out bot messages and system messages, keep only user messages
        const userMessages = messages.filter(msg =>
            !msg.bot_id &&
            msg.type === 'message' &&
            !msg.subtype // Exclude system messages like channel_join, etc.
        );

        console.log(`   → ${userMessages.length} user messages (after filtering)`);
        return userMessages;

    } catch (error) {
        console.error('Error fetching Slack messages:', error.message);
        return [];
    }
}

/**
 * Fetch user info from Slack (for displaying names in summaries)
 * @param {string} userId - Slack user ID
 * @returns {Promise<object|null>} - User info object
 */
async function fetchUserInfo(userId) {
    try {
        const response = await axios.get(`${SLACK_API_BASE}/users.info`, {
            headers: {
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                user: userId
            }
        });

        if (!response.data.ok) {
            return null;
        }

        return response.data.user;

    } catch (error) {
        console.error('Error fetching user info:', error.message);
        return null;
    }
}

/**
 * Format messages for Claude summarization
 * Converts raw Slack messages to readable format
 * @param {Array} messages - Array of Slack message objects
 * @returns {string} - Formatted message history
 */
function formatMessagesForSummary(messages) {
    // Sort messages by timestamp (oldest first)
    const sortedMessages = messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    let formatted = '';

    sortedMessages.forEach(msg => {
        const timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString();
        const userId = msg.user || 'Unknown';
        const text = msg.text || '';

        // Simple formatting - Claude will understand this
        formatted += `[${timestamp}] User ${userId}: ${text}\n\n`;
    });

    return formatted;
}

module.exports = {
    clientNameToChannelName,
    findChannelByName,
    autoMatchChannel,
    fetchChannelMessages,
    fetchUserInfo,
    formatMessagesForSummary
};
