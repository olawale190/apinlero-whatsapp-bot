/**
 * Àpínlẹ̀rọ WhatsApp Bot Server
 *
 * Webhook server for WhatsApp Business API
 * Handles incoming messages and processes orders
 */

import express from 'express';
import dotenv from 'dotenv';
import { handleIncomingMessage } from './message-handler.js';
import { sendWhatsAppMessage } from './whatsapp-api.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'apinlero-verify-token';

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Àpínlẹ̀rọ WhatsApp Bot',
    version: '1.0.0'
  });
});

// Webhook verification (GET request from Meta)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔐 Webhook verification request:', { mode, token });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// Incoming messages (POST request from Meta)
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Check if this is a WhatsApp message
    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    // Process each entry
    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];
          const contact = contacts[i] || {};

          // Extract message details
          const from = message.from; // Phone number
          const messageId = message.id;
          const timestamp = message.timestamp;
          const messageType = message.type;
          const customerName = contact.profile?.name || 'Customer';

          // Get message text
          let text = '';
          if (messageType === 'text') {
            text = message.text?.body || '';
          } else if (messageType === 'interactive') {
            text = message.interactive?.button_reply?.title ||
                   message.interactive?.list_reply?.title || '';
          }

          console.log(`📩 Message from ${customerName} (${from}): ${text}`);

          // Process the message
          const response = await handleIncomingMessage({
            from,
            customerName,
            text,
            messageId,
            timestamp,
            messageType
          });

          // Send response
          if (response) {
            await sendWhatsAppMessage(from, response.text, response.buttons);
            console.log(`📤 Response sent to ${from}`);
          }
        }
      }
    }

    // Always respond with 200 to acknowledge receipt
    res.sendStatus(200);

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
  🚀 Àpínlẹ̀rọ WhatsApp Bot running on port ${PORT}

  Endpoints:
  - GET  /          Health check
  - GET  /webhook   Webhook verification
  - POST /webhook   Incoming messages

  Webhook URL: https://your-domain.com/webhook
  `);
});
