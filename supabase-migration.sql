-- Àpínlẹ̀rọ WhatsApp Bot - Supabase Migration
-- Run this in your Supabase SQL Editor

-- ============================================
-- WhatsApp Sessions Table (for conversation persistence)
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL DEFAULT 'INITIAL',
  pending_order JSONB,
  context JSONB DEFAULT '{}',
  customer_id UUID REFERENCES customers(id),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick phone lookup
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(phone);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_activity ON whatsapp_sessions(last_activity);

-- ============================================
-- WhatsApp Messages Table (for message logging)
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_text TEXT,
  intent TEXT,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for message queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_order ON whatsapp_messages(order_id);

-- ============================================
-- Add payment_status to orders if not exists
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
    ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- ============================================
-- Customers table updates (add phone index if missing)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ============================================
-- RPC Functions
-- ============================================

-- Function to decrement stock (if not exists)
CREATE OR REPLACE FUNCTION decrement_stock(product_id UUID, quantity INT)
RETURNS VOID AS $$
BEGIN
  -- This is a placeholder - adjust based on your stock tracking implementation
  -- If you have a stock_quantity column on products:
  -- UPDATE products SET stock_quantity = stock_quantity - quantity WHERE id = product_id;
  RAISE NOTICE 'Stock decrement called for product % with quantity %', product_id, quantity;
END;
$$ LANGUAGE plpgsql;

-- Function to increment customer stats
CREATE OR REPLACE FUNCTION increment_customer_stats(p_customer_id UUID, p_order_total NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET
    total_orders = COALESCE(total_orders, 0) + 1,
    total_spent = COALESCE(total_spent, 0) + p_order_total,
    updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Policy for service role access (bot uses service key)
CREATE POLICY "Service role has full access to sessions"
  ON whatsapp_sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to messages"
  ON whatsapp_messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- Cleanup function for expired sessions (optional)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM whatsapp_sessions
  WHERE last_activity < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run cleanup daily
-- (Requires pg_cron extension which may not be available on all Supabase plans)
-- SELECT cron.schedule('cleanup-whatsapp-sessions', '0 4 * * *', 'SELECT cleanup_expired_sessions()');

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL ON whatsapp_sessions TO authenticated;
GRANT ALL ON whatsapp_sessions TO service_role;
GRANT ALL ON whatsapp_messages TO authenticated;
GRANT ALL ON whatsapp_messages TO service_role;
