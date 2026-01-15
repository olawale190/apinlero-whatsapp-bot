/**
 * Àpínlẹ̀rọ WhatsApp Bot Server
 *
 * Webhook server for WhatsApp via Twilio
 * Handles incoming messages and processes orders
 */

const express = require('express');
const dotenv = require('dotenv');
const { sendWhatsAppMessage, parseTwilioWebhook } = require('./twilio-service');

dotenv.config();

const app = express();

// Parse URL-encoded bodies (Twilio sends form data)
app.use(express.urlencoded({ extended: false }));
// Also support JSON for legacy/testing
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Àpínlẹ̀rọ WhatsApp Bot',
    version: '2.0.0 (Twilio)',
    provider: 'Twilio WhatsApp Sandbox',
    features: [
      'Twilio WhatsApp integration',
      'Session persistence (Supabase)',
      'Customer tracking',
      'Message logging',
      'Payment flow'
    ]
  });
});

// Twilio WhatsApp webhook (POST request from Twilio)
app.post('/webhook/twilio', async (req, res) => {
  console.log('📨 Twilio webhook received');

  try {
    // Parse Twilio message
    const incomingMessage = parseTwilioWebhook(req.body);

    console.log(`📩 Message from ${incomingMessage.phoneNumber}: ${incomingMessage.body}`);

    // TODO: Integrate with existing message-handler.js
    // For now, send a simple acknowledgment
    const responseText = `Thanks for your message! Àpínlẹ̀rọ is now powered by Twilio.\\n\\nYou said: "${incomingMessage.body}"\\n\\nFull bot integration coming soon!`;

    await sendWhatsAppMessage(incomingMessage.from, responseText);
    console.log(`✅ Response sent to ${incomingMessage.phoneNumber}`);

    // Respond to Twilio with 200 OK
    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).send('Error processing message');
  }
});

// Legacy Meta webhook endpoints (kept for backward compatibility)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔐 Legacy webhook verification (Meta)');

  if (mode === 'subscribe' && token) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', (req, res) => {
  console.log('⚠️ Received message on legacy Meta webhook - ignoring');
  res.sendStatus(200);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 Àpínlẹ̀rọ WhatsApp Bot v2.0.0 (Twilio) running on port ${PORT}

Provider: Twilio WhatsApp Sandbox
WhatsApp Number: ${process.env.TWILIO_WHATSAPP_NUMBER}

Features:
✓ Twilio WhatsApp integration
✓ Session persistence (Supabase)
✓ Customer tracking
✓ Message logging
✓ Payment flow

Endpoints:
- GET  /               Health check
- POST /webhook/twilio Twilio WhatsApp webhook
- GET  /webhook        Legacy Meta verification
- POST /webhook        Legacy Meta messages

Webhook URL for Twilio: https://your-railway-url.up.railway.app/webhook/twilio
  `);
});

module.exports = app;
