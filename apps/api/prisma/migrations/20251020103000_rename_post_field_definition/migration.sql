PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "CustomFieldDefinition";
ALTER TABLE "PostFieldDefinition" RENAME TO "CustomFieldDefinition";

DROP INDEX IF EXISTS "PostFieldDefinition_postSettingId_order_idx";
CREATE INDEX "CustomFieldDefinition_postSettingId_order_idx" ON "CustomFieldDefinition"("postSettingId", "order");

DROP INDEX IF EXISTS "PostFieldDefinition_postSettingId_slug_key";
CREATE UNIQUE INDEX "CustomFieldDefinition_postSettingId_slug_key" ON "CustomFieldDefinition"("postSettingId", "slug");

PRAGMA foreign_keys=ON;
