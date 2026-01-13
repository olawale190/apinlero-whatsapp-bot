/**
 * Test WhatsApp Message Sending
 * Run with: node test-message.js
 */

import dotenv from 'dotenv';
dotenv.config();

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = 'v22.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

// Test recipient - the number you added in Meta Developer Console
const TEST_RECIPIENT = '447448682282'; // UK number from your screenshot

async function sendTestMessage() {
  console.log('🚀 Testing WhatsApp API Connection...\n');
  console.log('Phone Number ID:', PHONE_NUMBER_ID);
  console.log('API URL:', BASE_URL);
  console.log('Recipient:', TEST_RECIPIENT);
  console.log('');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: TEST_RECIPIENT,
    type: 'template',
    template: {
      name: 'hello_world',
      language: { code: 'en_US' }
    }
  };

  try {
    console.log('📤 Sending test message...\n');

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ SUCCESS! Message sent successfully!\n');
      console.log('Response:', JSON.stringify(data, null, 2));
      console.log('\n📱 Check your WhatsApp for the test message!');
    } else {
      console.log('❌ ERROR: Failed to send message\n');
      console.log('Status:', response.status);
      console.log('Error:', JSON.stringify(data, null, 2));

      if (data.error?.code === 190) {
        console.log('\n⚠️  Token may have expired. Generate a new one from Meta Developer Console.');
      }
    }
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
}

sendTestMessage();
