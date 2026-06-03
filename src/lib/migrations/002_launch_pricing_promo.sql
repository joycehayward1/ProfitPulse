-- Launch pricing promo — locks in discounted ARB rate for early customers
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS pricing_promo TEXT
  CHECK (pricing_promo IS NULL OR pricing_promo IN ('launch'));
