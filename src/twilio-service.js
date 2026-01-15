const twilio = require('twilio');
require('dotenv').config();

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

if (!accountSid || !authToken || !twilioWhatsAppNumber) {
  console.error('❌ Missing Twilio credentials in environment variables');
  console.error('Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER');
  console.error('Found:', { accountSid: !!accountSid, authToken: !!authToken, whatsappNumber: !!twilioWhatsAppNumber });
  process.exit(1);
}

const client = twilio(accountSid, authToken);
console.log('✅ Twilio client initialized successfully');

/**
 * Send WhatsApp message via Twilio
 * @param {string} to - Recipient WhatsApp number (format: whatsapp:+1234567890)
 * @param {string} body - Message text
 * @returns {Promise<Object>} Twilio message response
 */
async function sendWhatsAppMessage(to, body) {
  try {
    // Ensure 'to' number is in correct format
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const message = await client.messages.create({
      from: twilioWhatsAppNumber,
      to: formattedTo,
      body: body
    });

    console.log(`✅ WhatsApp message sent via Twilio: ${message.sid}`);
    return {
      success: true,
      messageId: message.sid,
      status: message.status
    };
  } catch (error) {
    console.error('❌ Failed to send WhatsApp message via Twilio:', error.message);
    throw error;
  }
}

/**
 * Parse incoming Twilio webhook request
 * @param {Object} body - Express req.body from Twilio webhook
 * @returns {Object} Parsed message data
 */
function parseTwilioWebhook(body) {
  return {
    from: body.From, // Format: whatsapp:+1234567890
    to: body.To,     // Format: whatsapp:+14155238886
    body: body.Body, // Message text
    messageId: body.MessageSid,
    numMedia: parseInt(body.NumMedia || '0'),
    // Clean phone number (remove 'whatsapp:' prefix)
    phoneNumber: body.From?.replace('whatsapp:', ''),
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  sendWhatsAppMessage,
  parseTwilioWebhook,
  twilioClient: client
};
