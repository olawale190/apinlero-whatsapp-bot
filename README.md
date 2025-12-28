# Àpínlẹ̀rọ WhatsApp Bot

WhatsApp Business API bot for Isha's Treat & Groceries - African & Caribbean wholesale business in London.

## Features

- **Intelligent Order Parsing**: Understands natural language orders with Nigerian/Caribbean product aliases
- **Multi-step Order Flow**: Guides customers through complete order process
- **Delivery Zone Calculation**: Automatic London postcode zone detection
- **Product Matching**: Fuzzy matching with cultural aliases (e.g., "red oil" → "Palm Oil")
- **Conversation State**: Remembers context within sessions
- **Supabase Integration**: Orders saved directly to database

## Setup

### 1. Meta Business Setup

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Create or select a Business Account
3. Go to WhatsApp > Getting Started
4. Add a phone number for your business
5. Get your:
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
   - **Access Token**

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=apinlero-verify-token  # Choose your own
WHATSAPP_BUSINESS_ID=your-business-id

# Supabase
SUPABASE_URL=https://hxuzzhtjmpkhhmefajde.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Server
PORT=3000
```

### 3. Deploy

The bot needs to be publicly accessible for Meta's webhook. Options:

**Railway:**
```bash
railway up
```

**Vercel (Serverless):**
Requires adaptation to serverless functions.

**ngrok (Local Testing):**
```bash
npm run dev
ngrok http 3000
```

### 4. Configure Webhook in Meta

1. Go to WhatsApp > Configuration > Webhook
2. Enter your webhook URL: `https://your-domain.com/webhook`
3. Enter your verify token (same as `WHATSAPP_VERIFY_TOKEN`)
4. Subscribe to `messages` webhook field

## Usage

### Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

### Test Locally

```bash
# Health check
curl http://localhost:3000/

# Simulate webhook verification
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=apinlero-verify-token&hub.challenge=test"
```

## Message Flow

```
Customer: "Hi"
Bot: Welcome message + menu

Customer: "2x Palm Oil 5L and 3 bags rice"
Bot: Order summary + request confirmation

Customer: "Deliver to 45 High St E1 4AA"
Bot: Updated order with delivery fee

Customer: "Yes"
Bot: Order confirmed + payment details
```

## Supported Commands

| Customer Message | Bot Response |
|-----------------|--------------|
| "Hi" / "Hello" | Welcome + menu |
| "2x Palm Oil" | Create order |
| "How much is egusi?" | Price info |
| "Do you have plantain?" | Availability |
| "Do you deliver to SE1?" | Delivery info |
| "Track my order" | Order status |
| "Yes" / "Confirm" | Confirm pending order |
| "Cancel" | Cancel order |

## Product Aliases

The bot understands cultural names:

| Product | Also Known As |
|---------|---------------|
| Palm Oil 5L | red oil, zomi, epo pupa |
| Egusi Seeds | melon seeds, agusi |
| Stockfish | okporoko, panla |
| Yam Flour | elubo, amala |
| Cassava Flour | garri, eba |
| Scotch Bonnet | ata rodo, pepper |

## Files

```
whatsapp-bot/
├── src/
│   ├── server.js          # Express webhook server
│   ├── whatsapp-api.js    # Meta API client
│   ├── message-handler.js # Main logic
│   ├── message-parser.js  # Intent & item extraction
│   ├── response-templates.js # Bot responses
│   └── supabase-client.js # Database operations
├── .env.example
├── package.json
└── README.md
```

## Deployment Notes

- Webhook must respond within 20 seconds
- Always return 200 status to acknowledge receipt
- Process messages asynchronously if needed
- Use Redis for conversation state in production
