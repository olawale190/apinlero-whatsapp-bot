/**
 * WhatsApp Business API Client
 *
 * Sends messages via Meta's WhatsApp Business API
 */

import dotenv from 'dotenv';
dotenv.config();

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = 'v18.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

/**
 * Send a WhatsApp message
 * @param {string} to - Recipient phone number (with country code)
 * @param {string} text - Message text
 * @param {Array} buttons - Optional quick reply buttons
 */
export async function sendWhatsAppMessage(to, text, buttons = []) {
  // Ensure phone number has country code
  const recipient = to.startsWith('+') ? to.substring(1) : to;

  let payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient
  };

  if (buttons.length > 0 && buttons.length <= 3) {
    // Interactive message with buttons
    payload.type = 'interactive';
    payload.interactive = {
      type: 'button',
      body: { text },
      action: {
        buttons: buttons.slice(0, 3).map((btn, idx) => ({
          type: 'reply',
          reply: {
            id: `btn_${idx}_${Date.now()}`,
            title: btn.substring(0, 20) // Max 20 chars
          }
        }))
      }
    };
  } else {
    // Simple text message
    payload.type = 'text';
    payload.text = { body: text };
  }

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      throw new Error(data.error?.message || 'Failed to send message');
    }

    return data;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    throw error;
  }
}

/**
 * Send a message with a list of options
 * @param {string} to - Recipient phone number
 * @param {string} text - Message text
 * @param {string} buttonText - Button text to open list
 * @param {Array} sections - List sections with items
 */
export async function sendWhatsAppList(to, text, buttonText, sections) {
  const recipient = to.startsWith('+') ? to.substring(1) : to;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text },
      action: {
        button: buttonText.substring(0, 20),
        sections: sections.map(section => ({
          title: section.title.substring(0, 24),
          rows: section.items.slice(0, 10).map((item, idx) => ({
            id: `item_${idx}_${Date.now()}`,
            title: item.title.substring(0, 24),
            description: item.description?.substring(0, 72)
          }))
        }))
      }
    }
  };

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      throw new Error(data.error?.message || 'Failed to send list');
    }

    return data;
  } catch (error) {
    console.error('Failed to send WhatsApp list:', error);
    throw error;
  }
}

/**
 * Mark a message as read
 * @param {string} messageId - The message ID to mark as read
 */
export async function markAsRead(messageId) {
  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  };

  try {
    await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Failed to mark message as read:', error);
  }
}
