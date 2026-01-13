/**
 * Àpínlẹ̀rọ WhatsApp Bot Server
 *
 * Webhook server for WhatsApp Business API
 * Handles incoming messages and processes orders
 */

import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { handleIncomingMessage } from './message-handler.js';
import { sendWhatsAppMessage } from './whatsapp-api.js';

dotenv.config();

const app = express();

// Raw body parser for webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'apinlero-verify-token';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

/**
 * Verify webhook signature from Meta
 * @param {Request} req - Express request object
 * @returns {boolean} - Whether signature is valid
 */
function verifyWebhookSignature(req) {
  if (!APP_SECRET) {
    console.warn('⚠️ WHATSAPP_APP_SECRET not set - skipping signature verification');
    return true; // Skip verification if secret not configured
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn('⚠️ No signature header found');
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(req.rawBody)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    console.error('❌ Invalid webhook signature');
  }

  return isValid;
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Àpínlẹ̀rọ WhatsApp Bot',
    version: '1.1.0',
    features: [
      'Session persistence (Supabase)',
      'Customer tracking',
      'Message logging',
      'Payment flow',
      'Webhook verification'
    ]
  });
});

// Webhook verification (GET request from Meta)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔐 Webhook verification request:', { mode, hasToken: !!token });

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
  // Verify signature
  if (!verifyWebhookSignature(req)) {
    console.error('❌ Webhook signature verification failed');
    return res.sendStatus(401);
  }

  console.log('📨 Webhook POST received:', JSON.stringify(req.body).substring(0, 500));

  try {
    const body = req.body;

    // Check if this is a WhatsApp message
    if (body.object !== 'whatsapp_business_account') {
      console.log('❌ Not a WhatsApp message, object:', body.object);
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
          } else if (messageType === 'button') {
            text = message.button?.text || '';
          }

          // Skip empty messages
          if (!text.trim()) {
            console.log(`⏭️ Skipping empty/unsupported message type: ${messageType}`);
            continue;
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
            console.log('📤 Sending response to', from, ':', response.text.substring(0, 50) + '...');
            try {
              await sendWhatsAppMessage(from, response.text, response.buttons);
              console.log(`✅ Response sent to ${from}`);
            } catch (sendError) {
              console.error('❌ Failed to send response:', sendError.message);
            }
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

// Export for Vercel serverless
export default app;

// Start server if running directly (not on Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
  🚀 Àpínlẹ̀rọ WhatsApp Bot v1.1.0 running on port ${PORT}

  Features:
  ✓ Session persistence (Supabase)
  ✓ Customer tracking
  ✓ Message logging
  ✓ Payment flow
  ✓ Webhook signature verification

  Endpoints:
  - GET  /          Health check
  - GET  /webhook   Webhook verification
  - POST /webhook   Incoming messages

  Webhook URL: https://your-domain.com/webhook
    `);
  });
}
