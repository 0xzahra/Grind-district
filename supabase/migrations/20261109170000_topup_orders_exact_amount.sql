-- Exact-amount top-ups match on payer + amount; drop open-tag uniqueness.
drop index if exists public.topup_orders_open_tag_asset_uidx;
