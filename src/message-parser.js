/**
 * Àpínlẹ̀rọ Message Parser
 *
 * Intelligent parsing of WhatsApp messages to extract:
 * - Intent (order, inquiry, greeting, etc.)
 * - Order items (product + quantity)
 * - Delivery address
 * - Customer preferences
 */

// Product catalog with aliases (Nigerian, Caribbean, and common names)
const PRODUCT_ALIASES = {
  'Palm Oil 5L': ['palm oil', 'red oil', 'zomi', 'epo pupa', 'adin'],
  'Jollof Rice Mix': ['jollof', 'jollof rice', 'jollof mix', 'party jollof'],
  'Plantain (Green)': ['plantain', 'green plantain', 'unripe plantain', 'ogede'],
  'Egusi Seeds': ['egusi', 'melon seeds', 'agusi', 'egwusi'],
  'Stockfish': ['stockfish', 'stock fish', 'okporoko', 'panla'],
  'Scotch Bonnet Peppers': ['scotch bonnet', 'pepper', 'ata rodo', 'hot pepper', 'chili'],
  'Yam Flour': ['yam flour', 'elubo', 'amala flour', 'amala'],
  'Maggi Seasoning': ['maggi', 'seasoning', 'seasoning cubes', 'knorr'],
  'Cassava Flour': ['cassava', 'garri', 'eba', 'gari', 'cassava flour'],
  'Dried Crayfish': ['crayfish', 'dried crayfish', 'crawfish'],
  'Garden Eggs': ['garden eggs', 'african eggplant', 'igba'],
  'Fufu Flour': ['fufu', 'pounded yam', 'poundo', 'iyan'],
  'Coconut Oil 1L': ['coconut oil', 'coconut'],
  'Red Palm Oil': ['red palm oil', 'palm kernel oil'],
  'African Nutmeg': ['nutmeg', 'ehuru', 'ariwo']
};

// Intent keywords
const INTENT_PATTERNS = {
  GREETING: /^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)/i,
  PRODUCTS_LIST: /(products|catalog|catalogue|menu|what\s*(do\s*)?you\s*(have|sell|stock)|view\s*catalog|view\s*products|show\s*me|list)/i,
  START_ORDER: /(📦\s*)?(place\s*order|order\s*now|new\s*order|start\s*order|make\s*order)/i,
  ORDER: /(order|buy|want|need|get|send|deliver|i('d)?\s*like|can\s*i\s*have|please)/i,
  PRICE_CHECK: /(how\s*much|price|cost|what('s)?\s*the\s*price)/i,
  AVAILABILITY: /(do\s*you\s*have|available|in\s*stock|got\s*any)/i,
  DELIVERY: /(deliver|delivery|shipping|ship\s*to|send\s*to)/i,
  HOURS: /(open|close|hours|time|when)/i,
  ORDER_STATUS: /(track|where\s*is|status|my\s*order)/i,
  CANCEL: /(cancel|refund|return)/i,
  CONFIRM: /^(yes|yeah|yep|confirm|ok|okay|sure|correct|proceed|✅)$/i,
  DECLINE: /^(no|nope|cancel|stop|wrong|❌)$/i,
  THANKS: /(thank|thanks|cheers)/i,
  PAYMENT_CASH: /(💵\s*)?(cash|cash\s*on\s*delivery|cod|pay\s*cash|pay\s*on\s*delivery)/i,
  PAYMENT_CARD: /(💳\s*)?(card|pay\s*now|pay\s*online|debit|credit)/i,
  PAYMENT_TRANSFER: /(🏦\s*)?(bank\s*transfer|transfer|bank|bacs)/i
};

/**
 * Detect the intent of a message
 * @param {string} message - The message text
 * @returns {string} - The detected intent
 */
export function detectIntent(message) {
  const text = message.toLowerCase().trim();

  // Check for confirmation/decline first (exact matches)
  if (INTENT_PATTERNS.CONFIRM.test(text)) return 'CONFIRM';
  if (INTENT_PATTERNS.DECLINE.test(text)) return 'DECLINE';

  // Check for payment methods
  if (INTENT_PATTERNS.PAYMENT_CASH.test(text)) return 'PAYMENT_CASH';
  if (INTENT_PATTERNS.PAYMENT_CARD.test(text)) return 'PAYMENT_CARD';
  if (INTENT_PATTERNS.PAYMENT_TRANSFER.test(text)) return 'PAYMENT_TRANSFER';

  // Check other intents
  if (INTENT_PATTERNS.GREETING.test(text) && text.length < 30) return 'GREETING';
  if (INTENT_PATTERNS.START_ORDER.test(text)) return 'START_ORDER';
  if (INTENT_PATTERNS.PRODUCTS_LIST.test(text)) return 'PRODUCTS_LIST';
  if (INTENT_PATTERNS.PRICE_CHECK.test(text)) return 'PRICE_CHECK';
  if (INTENT_PATTERNS.AVAILABILITY.test(text)) return 'AVAILABILITY';
  if (INTENT_PATTERNS.DELIVERY.test(text) && !INTENT_PATTERNS.ORDER.test(text)) return 'DELIVERY_INQUIRY';
  if (INTENT_PATTERNS.HOURS.test(text)) return 'BUSINESS_HOURS';
  if (INTENT_PATTERNS.ORDER_STATUS.test(text)) return 'ORDER_STATUS';
  if (INTENT_PATTERNS.CANCEL.test(text)) return 'CANCEL';
  if (INTENT_PATTERNS.THANKS.test(text)) return 'THANKS';

  // Check if it looks like an order (has quantities or product names)
  if (hasOrderIndicators(text)) return 'NEW_ORDER';

  return 'GENERAL_INQUIRY';
}

/**
 * Check if message contains order indicators
 */
function hasOrderIndicators(text) {
  // Has quantity patterns
  const hasQuantity = /\d+\s*(x|kg|bags?|bottles?|packs?|pieces?|tins?|cartons?)/i.test(text);

  // Has product names
  const hasProduct = Object.values(PRODUCT_ALIASES).some(aliases =>
    aliases.some(alias => text.includes(alias.toLowerCase()))
  );

  // Has order keywords
  const hasOrderKeyword = INTENT_PATTERNS.ORDER.test(text);

  // Allow order with just product name + order keyword (no quantity needed)
  return (hasQuantity && hasProduct) || (hasOrderKeyword && hasProduct);
}

/**
 * Parse order items from message
 * @param {string} message - The message text
 * @returns {Array} - Array of {product, quantity, unit, matched}
 */
export function parseOrderItems(message) {
  const items = [];
  const text = message.toLowerCase();

  // Pattern 1: "2x Palm Oil" or "2 x palm oil"
  const pattern1 = /(\d+)\s*x\s*([a-zA-Z\s]+?)(?=,|\n|$|\d)/gi;

  // Pattern 2: "3 bags rice" or "5kg plantain"
  const pattern2 = /(\d+)\s*(bags?|bottles?|kg|packs?|pieces?|tins?|cartons?|liters?|l)\s+(?:of\s+)?([a-zA-Z\s]+?)(?=,|\n|$|\d)/gi;

  // Pattern 3: "palm oil - 2" or "rice 3"
  const pattern3 = /([a-zA-Z\s]+?)\s*[-–]?\s*(\d+)(?:\s*(bags?|bottles?|kg|packs?))?\s*(?=,|\n|$)/gi;

  // Pattern 4: Just product name without quantity (defaults to 1)
  // e.g., "I want coconut oil" or "order palm oil"

  // Extract with pattern 1
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    const quantity = parseInt(match[1]);
    const productText = match[2].trim();
    const matchedProduct = matchProduct(productText);

    if (matchedProduct) {
      items.push({
        product: matchedProduct,
        quantity,
        unit: 'Each',
        originalText: match[0]
      });
    }
  }

  // Extract with pattern 2
  while ((match = pattern2.exec(text)) !== null) {
    const quantity = parseInt(match[1]);
    const unit = normalizeUnit(match[2]);
    const productText = match[3].trim();
    const matchedProduct = matchProduct(productText);

    if (matchedProduct) {
      items.push({
        product: matchedProduct,
        quantity,
        unit,
        originalText: match[0]
      });
    }
  }

  // Extract with pattern 3 (only if we don't have items yet)
  if (items.length === 0) {
    while ((match = pattern3.exec(text)) !== null) {
      const productText = match[1].trim();
      const quantity = parseInt(match[2]);
      const unit = match[3] ? normalizeUnit(match[3]) : 'Each';
      const matchedProduct = matchProduct(productText);

      if (matchedProduct && quantity > 0 && quantity < 100) {
        items.push({
          product: matchedProduct,
          quantity,
          unit,
          originalText: match[0]
        });
      }
    }
  }

  // Pattern 4: If no items found, try to find product names and default to quantity 1
  if (items.length === 0) {
    for (const [productName, aliases] of Object.entries(PRODUCT_ALIASES)) {
      for (const alias of aliases) {
        if (text.includes(alias.toLowerCase())) {
          items.push({
            product: productName,
            quantity: 1,
            unit: 'Each',
            originalText: alias
          });
          break;
        }
      }
    }
  }

  // Deduplicate items
  const uniqueItems = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.product}-${item.unit}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

/**
 * Match product text to catalog product
 * @param {string} text - Product text from message
 * @returns {string|null} - Matched product name or null
 */
export function matchProduct(text) {
  const normalizedText = text.toLowerCase().trim();

  // Direct match on product name
  for (const [productName, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if (productName.toLowerCase().includes(normalizedText) ||
        normalizedText.includes(productName.toLowerCase())) {
      return productName;
    }

    // Check aliases
    for (const alias of aliases) {
      if (normalizedText.includes(alias) || alias.includes(normalizedText)) {
        return productName;
      }
    }
  }

  return null;
}

/**
 * Normalize unit strings
 */
function normalizeUnit(unit) {
  const u = unit.toLowerCase();
  if (u.includes('bag')) return 'bag';
  if (u.includes('bottle') || u.includes('liter') || u === 'l') return 'bottle';
  if (u.includes('kg')) return 'kg';
  if (u.includes('pack')) return 'pack';
  if (u.includes('piece')) return 'piece';
  if (u.includes('tin')) return 'tin';
  if (u.includes('carton')) return 'carton';
  return 'Each';
}

/**
 * Parse delivery address from message
 * @param {string} message - The message text
 * @returns {Object} - {address, postcode}
 */
export function parseAddress(message) {
  // UK postcode pattern
  const postcodeMatch = message.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i);

  // Address keywords
  const addressKeywords = ['deliver to', 'address:', 'delivery:', 'send to', 'at', 'location:'];
  let address = null;

  for (const kw of addressKeywords) {
    const idx = message.toLowerCase().indexOf(kw);
    if (idx !== -1) {
      // Extract text after keyword
      const afterKeyword = message.substring(idx + kw.length);
      // Take until newline or end
      address = afterKeyword.split('\n')[0].trim();
      // Remove leading punctuation
      address = address.replace(/^[:\s-]+/, '').trim();
      break;
    }
  }

  // If we found a postcode but no address, try to extract address around postcode
  if (!address && postcodeMatch) {
    // Look for text before postcode
    const postcodeIdx = message.indexOf(postcodeMatch[0]);
    const beforePostcode = message.substring(Math.max(0, postcodeIdx - 100), postcodeIdx);
    // Find last sentence or line
    const lines = beforePostcode.split(/[.\n]/);
    const lastLine = lines[lines.length - 1].trim();
    if (lastLine.length > 5) {
      address = lastLine + ' ' + postcodeMatch[0];
    }
  }

  return {
    address: address || null,
    postcode: postcodeMatch ? postcodeMatch[0].toUpperCase().replace(/\s+/, ' ') : null
  };
}

/**
 * Get delivery zone from postcode
 * @param {string} postcode - UK postcode
 * @returns {Object} - {zone, fee, estimatedDelivery}
 */
export function getDeliveryZone(postcode) {
  if (!postcode) return { zone: null, fee: 10, estimatedDelivery: '2-3 days' };

  const prefix = postcode.toUpperCase().match(/^[A-Z]+/)?.[0];

  const zones = {
    'E': { zone: 1, fee: 5, estimatedDelivery: 'Same day' },
    'N': { zone: 2, fee: 5, estimatedDelivery: 'Same day' },
    'SE': { zone: 3, fee: 5, estimatedDelivery: 'Next day' },
    'SW': { zone: 4, fee: 7, estimatedDelivery: 'Next day' },
    'W': { zone: 5, fee: 7, estimatedDelivery: 'Next day' },
    'NW': { zone: 6, fee: 7, estimatedDelivery: 'Next day' },
    'RM': { zone: 7, fee: 10, estimatedDelivery: '2-3 days' },
    'IG': { zone: 7, fee: 10, estimatedDelivery: '2-3 days' },
    'DA': { zone: 7, fee: 10, estimatedDelivery: '2-3 days' },
    'BR': { zone: 7, fee: 10, estimatedDelivery: '2-3 days' },
    'CR': { zone: 7, fee: 10, estimatedDelivery: '2-3 days' }
  };

  return zones[prefix] || { zone: 7, fee: 10, estimatedDelivery: '2-3 days' };
}

/**
 * Check if within business hours
 * @returns {boolean}
 */
export function isBusinessHours() {
  const now = new Date();
  // Convert to London time
  const londonTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const hour = londonTime.getHours();
  const day = londonTime.getDay();

  // Mon-Sat (1-6) 8AM-8PM
  return day >= 1 && day <= 6 && hour >= 8 && hour < 20;
}

/**
 * Parse the full message and return structured data
 * @param {string} message - The message text
 * @returns {Object} - Parsed message data
 */
export function parseMessage(message) {
  const intent = detectIntent(message);
  const items = parseOrderItems(message);
  const { address, postcode } = parseAddress(message);
  const deliveryZone = getDeliveryZone(postcode);

  return {
    intent,
    items,
    address,
    postcode,
    deliveryZone,
    isBusinessHours: isBusinessHours(),
    originalMessage: message
  };
}
