-- Update existing format values to new LINK variant
UPDATE "Post"
SET "format" = 'LINK'
WHERE "format" IN ('URL', 'FILE');

-- Add detailPageEnabled flag with default false
ALTER TABLE "Post" ADD COLUMN "detailPageEnabled" BOOLEAN NOT NULL DEFAULT false;
