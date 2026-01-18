/**
 * Àpínlẹ̀rọ WhatsApp Bot Server v2.1.0
 *
 * Webhook server for WhatsApp via Twilio
 * Now with full message handler integration!
 */

import express from 'express';
import dotenv from 'dotenv';
import { sendWhatsAppMessage, parseTwilioWebhook } from './twilio-service.js';
import { handleIncomingMessage } from './message-handler.js';

dotenv.config();

const app = express();

// Parse URL-encoded bodies (Twilio sends form data)
app.use(express.urlencoded({ extended: false }));
// Also support JSON for testing
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Àpínlẹ̀rọ WhatsApp Bot',
    version: '2.1.0 (Twilio + Message Handler)',
    provider: 'Twilio WhatsApp Sandbox',
    features: [
      'Twilio WhatsApp integration',
      'Full message handler',
      'Natural language order parsing',
      'Product alias matching (Yoruba + English)',
      'Session persistence (Supabase)',
      'Customer tracking',
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

    // Process message through the full handler
    const response = await handleIncomingMessage({
      from: incomingMessage.phoneNumber,
      customerName: incomingMessage.profileName || null,
      text: incomingMessage.body,
      messageId: incomingMessage.messageId
    });

    // Send response via WhatsApp
    if (response && response.text) {
      await sendWhatsAppMessage(incomingMessage.from, response.text);
      console.log(`✅ Response sent to ${incomingMessage.phoneNumber}`);
    }

    // Respond to Twilio with 200 OK
    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ Webhook error:', error);

    // Send error message to user
    try {
      const incomingMessage = parseTwilioWebhook(req.body);
      await sendWhatsAppMessage(
        incomingMessage.from,
        "Sorry, there was an error processing your message. Please try again or contact us directly."
      );
    } catch (e) {
      // Ignore send errors
    }

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
🚀 Àpínlẹ̀rọ WhatsApp Bot v2.1.0 running on port ${PORT}

Provider: Twilio WhatsApp Sandbox
WhatsApp Number: ${process.env.TWILIO_WHATSAPP_NUMBER || 'Not configured'}

Features:
✓ Full message handler integration
✓ Natural language order parsing
✓ Product alias matching (Yoruba + English)
✓ Session persistence (Supabase)
✓ Customer tracking
✓ Payment flow

Endpoints:
- GET  /               Health check
- POST /webhook/twilio Twilio WhatsApp webhook
- GET  /webhook        Legacy Meta verification
- POST /webhook        Legacy Meta messages

Webhook URL for Twilio: https://your-deployment-url/webhook/twilio
  `);
});

export default app;
