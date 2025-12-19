-- Allow current_code to be null during editing phase
-- With line diff optimization, we only populate current_code after Preview/finalization

ALTER TABLE hybrid_customizations 
ALTER COLUMN current_code DROP NOT NULL;

-- Add comment explaining the optimization
COMMENT ON COLUMN hybrid_customizations.current_code IS 'Current state after modifications - populated only after Preview/finalization in line diff optimization';