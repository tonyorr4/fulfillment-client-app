/**
 * Claude AI Service
 * Handles AI summarization using Anthropic's Claude API
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Generate summary of Slack messages using Claude
 * @param {string} messages - Formatted message history
 * @param {string} clientName - Client name for context
 * @param {boolean} isInitial - Whether this is the initial full history summary
 * @returns {Promise<string>} - Generated summary
 */
async function generateSlackSummary(messages, clientName, isInitial = false) {
    try {
        console.log(`🤖 Generating ${isInitial ? 'initial' : 'incremental'} summary for ${clientName}...`);
        console.log(`   Message length: ${messages.length} characters`);

        const systemPrompt = `You are an operations assistant helping summarize Slack channel discussions for fulfillment operations teams.

Your task is to analyze Slack messages from client-specific channels and create concise summaries highlighting:
1. **Important operational issues** - Problems, blockers, urgent requests
2. **SOPs and procedures** - Standard operating procedures, packing instructions, special handling
3. **Client requests** - Feature requests, changes to requirements
4. **Action items** - Tasks that need to be completed
5. **Key decisions** - Important agreements or changes

Focus on information that operations teams need to know to fulfill orders correctly and efficiently.

${isInitial ? 'This is an initial summary of the entire channel history.' : 'This is an incremental update with recent messages only.'}`;

        const userPrompt = `Please analyze these Slack messages from the #client-${clientName.toLowerCase().replace(/\s+/g, '-')} channel and provide a summary:

${messages}

Please structure your summary as follows:

## 🔴 Critical Issues
[List any urgent problems, blockers, or issues that need immediate attention]

## 📋 SOPs & Procedures
[List standard operating procedures, packing instructions, special handling requirements]

## 📦 Client Requests
[List any client requests, feature asks, or requirement changes]

## ✅ Action Items
[List specific tasks that need to be completed]

## 💡 Key Decisions
[List important agreements, decisions, or changes]

## 📊 General Updates
[Any other relevant information for operations]

If a section has no relevant information, write "None" for that section. Be concise but include specific details when relevant.`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            temperature: 0.3,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userPrompt
                }
            ]
        });

        const summary = response.content[0].text;

        console.log(`✅ Summary generated (${summary.length} characters)`);
        console.log(`   Input tokens: ${response.usage.input_tokens}`);
        console.log(`   Output tokens: ${response.usage.output_tokens}`);

        // Calculate approximate cost
        const inputCost = (response.usage.input_tokens / 1000000) * 3; // $3 per 1M input tokens
        const outputCost = (response.usage.output_tokens / 1000000) * 15; // $15 per 1M output tokens
        const totalCost = inputCost + outputCost;
        console.log(`   Estimated cost: $${totalCost.toFixed(4)}`);

        return summary;

    } catch (error) {
        console.error('Error generating summary with Claude:', error.message);
        throw error;
    }
}

/**
 * Generate a combined summary from old summary + new messages
 * This is more efficient than re-summarizing everything
 * @param {string} oldSummary - Previous summary
 * @param {string} newMessages - New messages since last summary
 * @param {string} clientName - Client name for context
 * @returns {Promise<string>} - Updated summary
 */
async function updateIncrementalSummary(oldSummary, newMessages, clientName) {
    try {
        console.log(`🤖 Updating incremental summary for ${clientName}...`);

        const systemPrompt = `You are an operations assistant helping maintain up-to-date Slack channel summaries for fulfillment operations teams.`;

        const userPrompt = `Here is the existing summary for #client-${clientName.toLowerCase().replace(/\s+/g, '-')}:

${oldSummary}

---

Here are NEW messages since the last summary:

${newMessages}

---

Please update the summary to incorporate the new messages. Keep the same structure:
- 🔴 Critical Issues
- 📋 SOPs & Procedures
- 📦 Client Requests
- ✅ Action Items
- 💡 Key Decisions
- 📊 General Updates

Rules:
1. Add new information from the recent messages
2. Keep relevant historical context from the old summary
3. Remove resolved items if explicitly mentioned in new messages
4. Mark completed action items as done
5. Be concise - focus on what operations needs to know

If there are no new messages or nothing important, return the original summary unchanged.`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            temperature: 0.3,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userPrompt
                }
            ]
        });

        const summary = response.content[0].text;

        console.log(`✅ Incremental summary updated`);
        console.log(`   Input tokens: ${response.usage.input_tokens}`);
        console.log(`   Output tokens: ${response.usage.output_tokens}`);

        return summary;

    } catch (error) {
        console.error('Error updating incremental summary:', error.message);
        throw error;
    }
}

module.exports = {
    generateSlackSummary,
    updateIncrementalSummary
};
