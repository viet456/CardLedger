CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX card_name_trgm_idx
ON "Card"
USING GIN ("name" gin_trgm_ops);
