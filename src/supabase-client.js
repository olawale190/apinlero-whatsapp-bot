/**
 * Àpínlẹ̀rọ Supabase Client
 *
 * Database operations for the WhatsApp bot
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Get all active products
 */
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Failed to fetch products:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a single product by ID
 */
export async function getProductById(id) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Failed to fetch product:', error);
    return null;
  }

  return data;
}

/**
 * Get product by name (fuzzy match)
 */
export async function getProductByName(name) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Create a new order
 */
export async function createOrder(orderData) {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      customer_name: orderData.customer_name,
      phone_number: orderData.phone_number,
      email: orderData.email || null,
      items: orderData.items,
      subtotal: orderData.subtotal,
      delivery_fee: orderData.delivery_fee,
      total: orderData.total,
      delivery_address: orderData.delivery_address,
      delivery_method: orderData.delivery_method || 'delivery',
      channel: orderData.channel || 'WhatsApp',
      status: orderData.status || 'Pending',
      payment_method: orderData.payment_method || 'pending',
      notes: orderData.notes || null
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create order:', error);
    throw error;
  }

  // Update stock quantities
  for (const item of orderData.items) {
    if (item.product_id) {
      await supabase.rpc('decrement_stock', {
        product_id: item.product_id,
        quantity: item.quantity
      });
    }
  }

  return data;
}

/**
 * Get orders by phone number
 */
export async function getOrderByPhone(phone) {
  // Normalize phone number
  const normalizedPhone = phone.replace(/\D/g, '');

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .or(`phone_number.eq.${phone},phone_number.eq.${normalizedPhone},phone_number.eq.+${normalizedPhone}`)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Failed to fetch orders:', error);
    return [];
  }

  return data || [];
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId, status) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }

  return data;
}

/**
 * Get or create customer by phone
 */
export async function getOrCreateCustomer(phone, name) {
  // Try to find existing customer
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existing) {
    return existing;
  }

  // Create new customer
  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert({
      phone,
      name,
      channel: 'WhatsApp',
      total_orders: 0,
      total_spent: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create customer:', error);
    return null;
  }

  return newCustomer;
}

/**
 * Log WhatsApp message
 */
export async function logMessage(phone, direction, text, intent = null, orderId = null) {
  try {
    await supabase
      .from('whatsapp_messages')
      .insert({
        phone_number: phone,
        direction,
        message_text: text,
        intent,
        order_id: orderId
      });
  } catch (error) {
    // Don't fail on logging errors
    console.error('Failed to log message:', error);
  }
}
