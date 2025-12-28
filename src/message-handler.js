/**
 * Àpínlẹ̀rọ Message Handler
 *
 * Processes incoming WhatsApp messages and generates responses
 * Manages conversation state and order flow
 */

import { parseMessage, matchProduct, getDeliveryZone } from './message-parser.js';
import { getProducts, createOrder, getOrderByPhone } from './supabase-client.js';
import { generateResponse } from './response-templates.js';

// In-memory conversation state (use Redis in production)
const conversations = new Map();

// Conversation timeout (30 minutes)
const CONVERSATION_TIMEOUT = 30 * 60 * 1000;

/**
 * Get or create conversation state for a customer
 */
function getConversation(phone) {
  const existing = conversations.get(phone);

  if (existing && Date.now() - existing.lastActivity < CONVERSATION_TIMEOUT) {
    existing.lastActivity = Date.now();
    return existing;
  }

  // Create new conversation
  const conversation = {
    phone,
    state: 'INITIAL',
    pendingOrder: null,
    lastActivity: Date.now(),
    context: {}
  };

  conversations.set(phone, conversation);
  return conversation;
}

/**
 * Update conversation state
 */
function updateConversation(phone, updates) {
  const conversation = getConversation(phone);
  Object.assign(conversation, updates, { lastActivity: Date.now() });
  conversations.set(phone, conversation);
  return conversation;
}

/**
 * Main message handler
 * @param {Object} params - Message parameters
 * @returns {Object} - Response {text, buttons}
 */
export async function handleIncomingMessage({ from, customerName, text, messageId }) {
  const conversation = getConversation(from);
  const parsed = parseMessage(text);

  console.log(`📝 Parsed message:`, {
    intent: parsed.intent,
    items: parsed.items.length,
    state: conversation.state
  });

  // Handle based on intent and conversation state
  try {
    switch (parsed.intent) {
      case 'GREETING':
        return handleGreeting(customerName, conversation);

      case 'NEW_ORDER':
        return await handleNewOrder(from, customerName, parsed, conversation);

      case 'CONFIRM':
        return await handleConfirmation(from, customerName, conversation);

      case 'DECLINE':
        return handleDecline(conversation);

      case 'PRICE_CHECK':
        return await handlePriceCheck(text);

      case 'AVAILABILITY':
        return await handleAvailability(text);

      case 'DELIVERY_INQUIRY':
        return handleDeliveryInquiry(parsed);

      case 'BUSINESS_HOURS':
        return handleBusinessHours(parsed.isBusinessHours);

      case 'ORDER_STATUS':
        return await handleOrderStatus(from);

      case 'CANCEL':
        return handleCancel(conversation);

      case 'THANKS':
        return handleThanks(customerName);

      default:
        return handleGeneralInquiry(text, conversation);
    }
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
    notFoundProducts: notFound
  };

  updateConversation(phone, {
    state: 'AWAITING_CONFIRMATION',
    pendingOrder
  });

  // Check if we need address
  if (!address && !postcode) {
    updateConversation(phone, { state: 'AWAITING_ADDRESS' });
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
      notes: `Postcode: ${order.postcode || 'Not provided'}`
    });

    // Clear conversation state
    updateConversation(phone, {
      state: 'ORDER_CONFIRMED',
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
        inStock: product.stock_quantity > 0
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
        inStock: product.stock_quantity > 0,
        quantity: product.stock_quantity
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
function handleCancel(conversation) {
  updateConversation(conversation.phone, {
    state: 'INITIAL',
    pendingOrder: null
  });
  return generateResponse('CANCELLED');
}

/**
 * Handle thanks messages
 */
function handleThanks(customerName) {
  return generateResponse('THANKS', { customerName });
}

/**
 * Handle general inquiries
 */
function handleGeneralInquiry(text, conversation) {
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

      updateConversation(conversation.phone, {
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
