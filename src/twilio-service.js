import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

let client = null;

// Only initialize if credentials exist (allows for local testing without Twilio)
if (accountSid && authToken && twilioWhatsAppNumber) {
  client = twilio(accountSid, authToken);
  console.log('✅ Twilio client initialized successfully');
} else {
  console.warn('⚠️ Twilio credentials not configured - WhatsApp sending disabled');
  console.warn('Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER');
}

/**
 * Send WhatsApp message via Twilio
 * @param {string} to - Recipient WhatsApp number (format: whatsapp:+1234567890)
 * @param {string} body - Message text
 * @returns {Promise<Object>} Twilio message response
 */
export async function sendWhatsAppMessage(to, body) {
  if (!client) {
    console.warn('⚠️ Twilio not configured - message not sent');
    return { success: false, error: 'Twilio not configured' };
  }

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
export function parseTwilioWebhook(body) {
  return {
    from: body.From, // Format: whatsapp:+1234567890
    to: body.To,     // Format: whatsapp:+14155238886
    body: body.Body, // Message text
    messageId: body.MessageSid,
    numMedia: parseInt(body.NumMedia || '0'),
    profileName: body.ProfileName || null, // WhatsApp profile name
    // Clean phone number (remove 'whatsapp:' prefix)
    phoneNumber: body.From?.replace('whatsapp:', ''),
    timestamp: new Date().toISOString()
  };
}

export const twilioClient = client;
