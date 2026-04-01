-- Update interest check constraint to include 'news-polled'
ALTER TABLE stocks DROP CONSTRAINT IF EXISTS stocks_interest_check;
ALTER TABLE stocks ADD CONSTRAINT stocks_interest_check CHECK (interest IN ('interested', 'not-interested', 'news-polled'));
