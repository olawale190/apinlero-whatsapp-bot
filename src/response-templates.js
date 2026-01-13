/**
 * Àpínlẹ̀rọ Response Templates
 *
 * Pre-defined response templates for WhatsApp bot
 */

const TEMPLATES = {
  GREETING: ({ customerName }) => ({
    text: `Hello${customerName ? ` ${customerName}` : ''}! 👋

Welcome to Isha's Treat & Groceries!
Your home for authentic African & Caribbean products.

How can I help you today?

📦 To place an order, just send:
• Product names and quantities
• Your delivery address

Example:
"2x Palm Oil 5L
3 bags Jollof Rice Mix
Deliver to: 123 High St, London E1 1AA"

🛒 View our catalog: apinlero.vercel.app`,
    buttons: ['📦 Place Order', '📋 View Catalog', '💬 Help']
  }),

  ORDER_CONFIRMATION: ({ items, subtotal, deliveryFee, total, address, deliveryZone, notFound }) => {
    let itemList = items.map(item =>
      `• ${item.quantity}x ${item.product_name} - £${item.subtotal.toFixed(2)}`
    ).join('\n');

    let notFoundText = notFound && notFound.length > 0
      ? `\n\n⚠️ Could not find: ${notFound.join(', ')}`
      : '';

    return {
      text: `Thank you for your order! 📝

Please confirm these items:

${itemList}

Subtotal: £${subtotal.toFixed(2)}
Delivery (${deliveryZone?.estimatedDelivery || 'Standard'}): £${deliveryFee.toFixed(2)}
━━━━━━━━━━━━
Total: £${total.toFixed(2)}

📍 Delivery to: ${address || 'Not provided'}${notFoundText}

Reply YES to confirm or let me know any changes.`,
      buttons: ['✅ YES, Confirm', '✏️ Make Changes', '❌ Cancel']
    };
  },

  ORDER_CONFIRMED: ({ orderId, total, address, deliveryEstimate }) => ({
    text: `✅ Order Confirmed!

Order #: ${orderId.substring(0, 8).toUpperCase()}
Total: £${total.toFixed(2)}

💳 *Pay Now:*
https://project-apinlero.vercel.app/checkout?order=${orderId.substring(0, 8)}

Or choose:
• 💵 Cash on Delivery
• 🏦 Bank Transfer:
  Isha's Treat Ltd
  Sort: 04-00-04
  Acc: 12345678
  Ref: ${orderId.substring(0, 8).toUpperCase()}

Delivery: ${deliveryEstimate}
We'll notify you when it's on the way!`,
    buttons: ['💳 Pay Now', '💵 Cash on Delivery']
  }),

  NEED_ADDRESS: ({ items, subtotal, notFound }) => {
    let itemList = items.map(item =>
      `• ${item.quantity}x ${item.product_name} - £${item.subtotal.toFixed(2)}`
    ).join('\n');

    return {
      text: `Great! I've got your order:

${itemList}

Subtotal: £${subtotal.toFixed(2)}

📍 Please send your delivery address with postcode.

Example: "45 High Street, London E1 4AA"`,
      buttons: []
    };
  },

  STILL_NEED_ADDRESS: () => ({
    text: `I still need your delivery address to complete the order.

Please send your full address with postcode.

Example: "45 High Street, London E1 4AA"`,
    buttons: []
  }),

  ORDER_UNCLEAR: () => ({
    text: `I couldn't understand your order. 😅

Please try again with this format:
• Quantity + Product name

Examples:
"2x Palm Oil 5L"
"3 bags Jollof Rice"
"5kg Plantain"

Or browse our catalog: apinlero.vercel.app`,
    buttons: ['📋 View Catalog', '💬 Help']
  }),

  PRODUCTS_NOT_FOUND: ({ products }) => ({
    text: `I couldn't find these products in our catalog:
${products.map(p => `• ${p}`).join('\n')}

Would you like to:
1. Try different names
2. Browse our catalog: apinlero.vercel.app

Popular products:
• Palm Oil 5L
• Jollof Rice Mix
• Plantain (Green)
• Egusi Seeds
• Stockfish`,
    buttons: ['📋 View Catalog', '💬 Help']
  }),

  NO_PENDING_ORDER: () => ({
    text: `You don't have a pending order to confirm.

Would you like to place a new order?

Just send:
• Product names and quantities
• Your delivery address`,
    buttons: ['📦 Place Order', '📋 View Catalog']
  }),

  ORDER_EDIT_PROMPT: () => ({
    text: `No problem! What would you like to change?

You can:
• Add more items
• Remove items
• Change quantities
• Update delivery address

Just tell me what you'd like to change.`,
    buttons: ['🔄 Start Over', '❌ Cancel Order']
  }),

  ORDER_CANCELLED: () => ({
    text: `Order cancelled. No problem!

Feel free to place a new order anytime.

Browse our products: apinlero.vercel.app`,
    buttons: ['📦 New Order', '📋 View Catalog']
  }),

  PRICE_INFO: ({ product, price, unit, inStock }) => ({
    text: `💰 ${product}

Price: £${price.toFixed(2)} per ${unit || 'item'}
${inStock ? '✅ In Stock' : '❌ Currently out of stock'}

Would you like to order this item?`,
    buttons: inStock ? ['📦 Order Now', '📋 View More'] : ['📋 View Alternatives']
  }),

  PRICE_NOT_FOUND: () => ({
    text: `I couldn't find that product.

Please check our catalog for available products:
apinlero.vercel.app

Or ask about a specific product like:
"How much is palm oil?"`,
    buttons: ['📋 View Catalog']
  }),

  AVAILABILITY_INFO: ({ product, inStock, quantity }) => ({
    text: `📦 ${product}

${inStock
  ? `✅ In Stock (${quantity} available)`
  : '❌ Currently out of stock'}

${inStock ? 'Would you like to place an order?' : 'Check back soon or try an alternative.'}`,
    buttons: inStock ? ['📦 Order Now'] : ['📋 View Alternatives']
  }),

  PRODUCT_NOT_FOUND: () => ({
    text: `I couldn't find that product in our catalog.

Browse all products: apinlero.vercel.app`,
    buttons: ['📋 View Catalog']
  }),

  DELIVERY_INFO: ({ postcode, zone, fee, estimate }) => ({
    text: `🚚 Delivery to ${postcode}

Zone: ${zone}
Delivery Fee: £${fee.toFixed(2)}
Estimated Time: ${estimate}

Ready to place an order?`,
    buttons: ['📦 Place Order', '📋 View Catalog']
  }),

  DELIVERY_GENERAL: () => ({
    text: `🚚 Delivery Information

We deliver across London:

Zone 1-2 (E, N): £5.00 - Same day
Zone 3 (SE): £5.00 - Next day
Zone 4-6 (SW, W, NW): £7.00 - Next day
Outer London: £10.00 - 2-3 days

Free delivery on orders over £50!

Send your postcode for exact pricing.`,
    buttons: ['📦 Place Order', '💬 Contact Us']
  }),

  BUSINESS_HOURS: ({ isOpen }) => ({
    text: `🕐 Business Hours

Monday - Saturday: 8:00 AM - 8:00 PM
Sunday: Closed

${isOpen
  ? '✅ We are currently OPEN'
  : '😴 We are currently CLOSED'}

${isOpen
  ? 'How can I help you today?'
  : 'Leave a message and we\'ll respond first thing tomorrow!'}`,
    buttons: isOpen ? ['📦 Place Order'] : ['📋 View Catalog']
  }),

  ORDER_STATUS: ({ orderId, status, total, createdAt }) => {
    const date = new Date(createdAt).toLocaleDateString('en-GB');
    const statusEmoji = {
      'Pending': '⏳',
      'Confirmed': '✅',
      'Out for Delivery': '🚚',
      'Delivered': '📦',
      'Cancelled': '❌'
    };

    return {
      text: `📋 Order Status

Order #: ${orderId.substring(0, 8).toUpperCase()}
Status: ${statusEmoji[status] || '📋'} ${status}
Total: £${total.toFixed(2)}
Date: ${date}

Questions about your order? Just reply here.`,
      buttons: ['💬 Contact Us']
    };
  },

  NO_ORDERS_FOUND: () => ({
    text: `I couldn't find any orders for your phone number.

Would you like to place a new order?`,
    buttons: ['📦 Place Order', '📋 View Catalog']
  }),

  ORDER_STATUS_ERROR: () => ({
    text: `Sorry, I couldn't retrieve your order status right now.

Please try again later or contact us directly:
📞 07448 682282`,
    buttons: ['💬 Contact Us']
  }),

  ORDER_FAILED: () => ({
    text: `Sorry, there was an error processing your order. 😔

Please try again or contact us directly:
📞 07448 682282
📧 WhatsApp this number

We apologize for the inconvenience.`,
    buttons: ['🔄 Try Again', '💬 Contact Us']
  }),

  CANCELLED: () => ({
    text: `Okay, I've cancelled that for you.

Is there anything else I can help with?`,
    buttons: ['📦 Place Order', '📋 View Catalog']
  }),

  THANKS: ({ customerName }) => ({
    text: `You're welcome${customerName ? `, ${customerName}` : ''}! 😊

Thank you for choosing Isha's Treat & Groceries.

Is there anything else I can help with?`,
    buttons: ['📦 Place Order', '📋 View Catalog']
  }),

  GENERAL_HELP: () => ({
    text: `Thanks for your message! 😊

I'm the Àpínlẹ̀rọ ordering assistant. I can help you with:

📦 *Place an order* - "I want 2x Palm Oil"
💰 *Check prices* - "How much is egusi?"
📋 *See products* - "Products" or "What do you have?"
🚚 *Delivery info* - "Delivery to SE1"
📍 *Track order* - "Order status"

For other questions, please contact us:
📞 07448 682282
📧 WhatsApp this number

Or browse: apinlero.vercel.app`,
    buttons: ['📋 View Products', '📦 Place Order', '💬 Contact Us']
  }),

  ERROR: () => ({
    text: `Sorry, something went wrong. 😔

Please try again or contact us:
📞 07448 682282

We apologize for the inconvenience.`,
    buttons: ['🔄 Try Again', '💬 Contact Us']
  }),

  OUT_OF_HOURS: () => ({
    text: `Thank you for your message! 🌙

We're currently closed but will respond first thing tomorrow.

Business Hours:
Mon-Sat: 8:00 AM - 8:00 PM
Sunday: Closed

For urgent orders, browse our website:
apinlero.vercel.app`,
    buttons: ['📋 View Catalog']
  }),

  PAYMENT_CONFIRMED: ({ method, orderId }) => ({
    text: `✅ Payment Method Confirmed!

Order #: ${orderId}
Payment: ${method}

${method === 'Cash on Delivery'
  ? `💵 Please have the exact amount ready when your order arrives.`
  : method === 'Bank Transfer'
    ? `🏦 Please transfer to:
  Isha's Treat Ltd
  Sort: 04-00-04
  Acc: 12345678
  Ref: ${orderId}

Once transferred, we'll confirm receipt and dispatch your order.`
    : `💳 You can pay securely at:
https://project-apinlero.vercel.app/checkout?order=${orderId}`
}

We'll notify you when your order is ready for delivery.

Thank you for your order! 🙏`,
    buttons: ['📍 Track Order', '💬 Contact Us']
  }),

  NO_PRODUCTS: () => ({
    text: `Sorry, we couldn't load our product catalog right now. 😔

Please try again in a moment or browse our website:
project-apinlero.vercel.app

Or contact us directly:
📞 07448 682282`,
    buttons: ['🔄 Try Again', '💬 Contact Us']
  })
};

/**
 * Generate a response from template
 * @param {string} templateName - Name of the template
 * @param {Object} params - Parameters for the template
 * @returns {Object} - {text, buttons}
 */
export function generateResponse(templateName, params = {}) {
  const template = TEMPLATES[templateName];

  if (!template) {
    console.error(`Template not found: ${templateName}`);
    return TEMPLATES.ERROR();
  }

  if (typeof template === 'function') {
    return template(params);
  }

  return template;
}
