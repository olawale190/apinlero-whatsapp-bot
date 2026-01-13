/**
 * Àpínlẹ̀rọ Message Handler
 *
 * Processes incoming WhatsApp messages and generates responses
 * Manages conversation state and order flow with Supabase persistence
 */

import { parseMessage, matchProduct, getDeliveryZone } from './message-parser.js';
import {
  getProducts,
  createOrder,
  getOrderByPhone,
  updateOrderPayment,
  getSession,
  saveSession,
  deleteSession,
  getOrCreateCustomer,
  logMessage
} from './supabase-client.js';
import { generateResponse } from './response-templates.js';

// In-memory cache for sessions (backed by Supabase)
const sessionCache = new Map();

/**
 * Get or create conversation state for a customer
 * Uses Supabase for persistence with in-memory cache
 */
async function getConversation(phone, customerName = null) {
  // Check cache first
  let conversation = sessionCache.get(phone);

  if (!conversation) {
    // Try to load from Supabase
    conversation = await getSession(phone);
  }

  if (conversation) {
    conversation.lastActivity = Date.now();
    sessionCache.set(phone, conversation);
    return conversation;
  }

  // Get or create customer record
  const customer = await getOrCreateCustomer(phone, customerName);

  // Create new conversation
  conversation = {
    phone,
    state: 'INITIAL',
    pendingOrder: null,
    lastActivity: Date.now(),
    context: {},
    customerId: customer?.id || null,
    customerName: customer?.name || customerName
  };

  sessionCache.set(phone, conversation);
  await saveSession(phone, conversation);

  return conversation;
}

/**
 * Update conversation state
 */
async function updateConversation(phone, updates) {
  const conversation = sessionCache.get(phone) || { phone };
  Object.assign(conversation, updates, { lastActivity: Date.now() });
  sessionCache.set(phone, conversation);

  // Persist to Supabase
  await saveSession(phone, conversation);

  return conversation;
}

/**
 * Clear conversation state
 */
async function clearConversation(phone) {
  sessionCache.delete(phone);
  await deleteSession(phone);
}

/**
 * Main message handler
 * @param {Object} params - Message parameters
 * @returns {Object} - Response {text, buttons}
 */
export async function handleIncomingMessage({ from, customerName, text, messageId }) {
  const conversation = await getConversation(from, customerName);
  const parsed = parseMessage(text);

  console.log(`📝 Parsed message:`, {
    intent: parsed.intent,
    items: parsed.items.length,
    state: conversation.state,
    customer: conversation.customerName || customerName
  });

  // Log inbound message
  await logMessage(from, 'inbound', text, parsed.intent);

  // Handle based on intent and conversation state
  try {
    let response;

    switch (parsed.intent) {
      case 'GREETING':
        response = handleGreeting(customerName, conversation);
        break;

      case 'PRODUCTS_LIST':
        response = await handleProductsList();
        break;

      case 'START_ORDER':
        response = await handleStartOrder(conversation);
        break;

      case 'NEW_ORDER':
        response = await handleNewOrder(from, customerName, parsed, conversation);
        break;

      case 'CONFIRM':
        response = await handleConfirmation(from, customerName, conversation);
        break;

      case 'DECLINE':
        response = handleDecline(conversation);
        break;

      case 'PRICE_CHECK':
        response = await handlePriceCheck(text);
        break;

      case 'AVAILABILITY':
        response = await handleAvailability(text);
        break;

      case 'DELIVERY_INQUIRY':
        response = handleDeliveryInquiry(parsed);
        break;

      case 'BUSINESS_HOURS':
        response = handleBusinessHours(parsed.isBusinessHours);
        break;

      case 'ORDER_STATUS':
        response = await handleOrderStatus(from);
        break;

      case 'CANCEL':
        response = await handleCancel(conversation);
        break;

      case 'THANKS':
        response = handleThanks(customerName);
        break;

      case 'PAYMENT_CASH':
        response = await handlePaymentChoice(from, conversation, 'cash');
        break;

      case 'PAYMENT_CARD':
        response = await handlePaymentChoice(from, conversation, 'card');
        break;

      case 'PAYMENT_TRANSFER':
        response = await handlePaymentChoice(from, conversation, 'bank_transfer');
        break;

      default:
        response = await handleGeneralInquiry(text, conversation);
    }

    // Log outbound message
    if (response) {
      await logMessage(from, 'outbound', response.text, parsed.intent, conversation.lastOrderId);
    }

    return response;

  } catch (error) {
    console.error('Message handling error:', error);
    return generateResponse('ERROR');
  }
}

/**
 * Handle greeting messages
 */
function handleGreeting(customerName, conversation) {
  updateConversation(conversation.phone, { state: 'GREETED' });
  return generateResponse('GREETING', { customerName });
}

/**
 * Handle new order requests
 */
async function handleNewOrder(phone, customerName, parsed, conversation) {
  const { items, address, postcode, deliveryZone } = parsed;

  if (items.length === 0) {
    // Couldn't parse any items
    return generateResponse('ORDER_UNCLEAR');
  }

  // Get product prices from database
  const products = await getProducts();
  const productMap = new Map(products.map(p => [p.name.toLowerCase(), p]));

  // Build order with prices
  const orderItems = [];
  const notFound = [];

  for (const item of items) {
    const product = productMap.get(item.product.toLowerCase()) ||
                    products.find(p => p.name.toLowerCase().includes(item.product.toLowerCase()));

    if (product) {
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit: item.unit,
        price: product.price,
        subtotal: product.price * item.quantity
      });
    } else {
      notFound.push(item.product);
    }
  }

  if (orderItems.length === 0) {
    return generateResponse('PRODUCTS_NOT_FOUND', { products: notFound });
  }

  // Calculate totals
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const deliveryFee = deliveryZone.fee;
  const total = subtotal + deliveryFee;

  // Store pending order
  const pendingOrder = {
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    address,
    postcode,
    deliveryZone,
    customerName,
    customerId: conversation.customerId,
    notFoundProducts: notFound
  };

  await updateConversation(phone, {
    state: 'AWAITING_CONFIRMATION',
    pendingOrder
  });

  // Check if we need address
  if (!address && !postcode) {
    await updateConversation(phone, { state: 'AWAITING_ADDRESS' });
    return generateResponse('NEED_ADDRESS', {
      items: orderItems,
      subtotal,
      notFound: notFound.length > 0 ? notFound : null
    });
  }

  // Send confirmation request
  return generateResponse('ORDER_CONFIRMATION', {
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    address,
    deliveryZone,
    notFound: notFound.length > 0 ? notFound : null
  });
}

/**
 * Handle order confirmation
 */
async function handleConfirmation(phone, customerName, conversation) {
  if (conversation.state === 'AWAITING_ADDRESS') {
    // They confirmed but we still need address
    return generateResponse('STILL_NEED_ADDRESS');
  }

  if (conversation.state !== 'AWAITING_CONFIRMATION' || !conversation.pendingOrder) {
    return generateResponse('NO_PENDING_ORDER');
  }

  const order = conversation.pendingOrder;

  try {
    // Create order in Supabase
    const createdOrder = await createOrder({
      customer_name: customerName,
      phone_number: phone,
      items: order.items,
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      total: order.total,
      delivery_address: order.address,
      delivery_method: 'delivery',
      channel: 'WhatsApp',
      status: 'Pending',
      payment_method: 'pending',
      notes: `Postcode: ${order.postcode || 'Not provided'}`,
      customer_id: conversation.customerId
    });

    // Update conversation state
    await updateConversation(phone, {
      state: 'AWAITING_PAYMENT',
      pendingOrder: null,
      lastOrderId: createdOrder.id
    });

    return generateResponse('ORDER_CONFIRMED', {
      orderId: createdOrder.id,
      total: order.total,
      address: order.address,
      deliveryEstimate: order.deliveryZone.estimatedDelivery
    });

  } catch (error) {
    console.error('Failed to create order:', error);
    return generateResponse('ORDER_FAILED');
  }
}

/**
 * Handle payment method selection
 */
async function handlePaymentChoice(phone, conversation, method) {
  const orderId = conversation.lastOrderId;

  if (!orderId) {
    return generateResponse('NO_PENDING_ORDER');
  }

  try {
    await updateOrderPayment(orderId, method, method === 'cash' ? 'pending' : 'awaiting');

    await updateConversation(phone, {
      state: 'ORDER_COMPLETED'
    });

    const methodLabels = {
      'cash': 'Cash on Delivery',
      'card': 'Card Payment',
      'bank_transfer': 'Bank Transfer'
    };

    return generateResponse('PAYMENT_CONFIRMED', {
      method: methodLabels[method],
      orderId: orderId.substring(0, 8).toUpperCase()
    });

  } catch (error) {
    console.error('Failed to update payment:', error);
    return generateResponse('ERROR');
  }
}

/**
 * Handle order decline/changes
 */
function handleDecline(conversation) {
  if (conversation.state === 'AWAITING_CONFIRMATION') {
    updateConversation(conversation.phone, {
      state: 'EDITING_ORDER',
      pendingOrder: conversation.pendingOrder
    });
    return generateResponse('ORDER_EDIT_PROMPT');
  }

  updateConversation(conversation.phone, { state: 'INITIAL' });
  return generateResponse('ORDER_CANCELLED');
}

/**
 * Handle price check requests
 */
async function handlePriceCheck(text) {
  const products = await getProducts();

  // Try to find the product mentioned
  for (const product of products) {
    if (text.toLowerCase().includes(product.name.toLowerCase()) ||
        matchProduct(text) === product.name) {
      return generateResponse('PRICE_INFO', {
        product: product.name,
        price: product.price,
        unit: product.unit,
        inStock: product.is_active
      });
    }
  }

  return generateResponse('PRICE_NOT_FOUND');
}

/**
 * Handle availability check
 */
async function handleAvailability(text) {
  const products = await getProducts();

  for (const product of products) {
    if (text.toLowerCase().includes(product.name.toLowerCase()) ||
        matchProduct(text) === product.name) {
      return generateResponse('AVAILABILITY_INFO', {
        product: product.name,
        inStock: product.is_active,
        quantity: 'Available'
      });
    }
  }

  return generateResponse('PRODUCT_NOT_FOUND');
}

/**
 * Handle delivery inquiries
 */
function handleDeliveryInquiry(parsed) {
  if (parsed.postcode) {
    const zone = getDeliveryZone(parsed.postcode);
    return generateResponse('DELIVERY_INFO', {
      postcode: parsed.postcode,
      zone: zone.zone,
      fee: zone.fee,
      estimate: zone.estimatedDelivery
    });
  }

  return generateResponse('DELIVERY_GENERAL');
}

/**
 * Handle business hours inquiry
 */
function handleBusinessHours(isOpen) {
  return generateResponse('BUSINESS_HOURS', { isOpen });
}

/**
 * Handle order status check
 */
async function handleOrderStatus(phone) {
  try {
    const orders = await getOrderByPhone(phone);

    if (!orders || orders.length === 0) {
      return generateResponse('NO_ORDERS_FOUND');
    }

    const latestOrder = orders[0];
    return generateResponse('ORDER_STATUS', {
      orderId: latestOrder.id,
      status: latestOrder.status,
      total: latestOrder.total,
      createdAt: latestOrder.created_at
    });
  } catch (error) {
    console.error('Failed to get order status:', error);
    return generateResponse('ORDER_STATUS_ERROR');
  }
}

/**
 * Handle cancellation request
 */
async function handleCancel(conversation) {
  await clearConversation(conversation.phone);
  return generateResponse('CANCELLED');
}

/**
 * Handle thanks messages
 */
function handleThanks(customerName) {
  return generateResponse('THANKS', { customerName });
}

/**
 * Handle start order request (when user clicks "Place Order" button)
 */
async function handleStartOrder(conversation) {
  // Show products with quick order option
  const products = await getProducts();

  if (!products || products.length === 0) {
    return generateResponse('NO_PRODUCTS');
  }

  // Show top products for quick ordering
  const topProducts = products.slice(0, 8);
  let text = `📦 *Quick Order*\n\nPopular items:\n\n`;

  topProducts.forEach((p, i) => {
    text += `${i + 1}. ${p.name} - £${p.price.toFixed(2)}\n`;
  });

  text += `\n*To order:* Just type the number or name!\nExample: "1" or "Palm Oil" or "2x Egusi"\n\n💳 Pay online or Cash on Delivery`;

  await updateConversation(conversation.phone, { state: 'AWAITING_ORDER' });

  return { text, buttons: ['📋 Full Catalog', '❌ Cancel'] };
}

/**
 * Handle products list request
 */
async function handleProductsList() {
  const products = await getProducts();

  if (!products || products.length === 0) {
    return generateResponse('NO_PRODUCTS');
  }

  // Group by category
  const categories = {};
  for (const p of products) {
    const cat = p.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(p);
  }

  let text = `📦 *Our Products*\n\n`;

  for (const [category, items] of Object.entries(categories)) {
    text += `*${category}*\n`;
    for (const item of items) {
      text += `• ${item.name} - £${item.price.toFixed(2)} (${item.unit})\n`;
    }
    text += '\n';
  }

  text += `\nTo order, send:\n"2x Palm Oil (5L), 3x Egusi Seeds"\n\nOr ask about a specific product!`;

  return { text, buttons: ['📦 Place Order', '💬 Help'] };
}

/**
 * Handle general inquiries
 */
async function handleGeneralInquiry(text, conversation) {
  // If waiting for address, treat this as address input
  if (conversation.state === 'AWAITING_ADDRESS') {
    const parsed = parseMessage(text);
    if (parsed.address || parsed.postcode) {
      // Update pending order with address
      const order = conversation.pendingOrder;
      order.address = parsed.address || text;
      order.postcode = parsed.postcode;
      order.deliveryZone = getDeliveryZone(parsed.postcode);
      order.deliveryFee = order.deliveryZone.fee;
      order.total = order.subtotal + order.deliveryFee;

      await updateConversation(conversation.phone, {
        state: 'AWAITING_CONFIRMATION',
        pendingOrder: order
      });

      return generateResponse('ORDER_CONFIRMATION', {
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        address: order.address,
        deliveryZone: order.deliveryZone
      });
    }
  }

  return generateResponse('GENERAL_HELP');
}
