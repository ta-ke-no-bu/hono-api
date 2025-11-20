PRAGMA foreign_keys=OFF;

CREATE TABLE "PostSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "description" TEXT,
  "appliesTo" TEXT,
  "enableDetailBody" INTEGER NOT NULL DEFAULT 0,
  "detailPageRequirement" TEXT NOT NULL DEFAULT 'OPTIONAL',
  "detailSlugPrefix" TEXT,
  "defaultCategoryId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  CONSTRAINT "PostSetting_slug_key" UNIQUE ("slug"),
  CONSTRAINT "PostSetting_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PostSetting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PostSetting_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PostFieldDefinition" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postSettingId" TEXT NOT NULL,
  "parentId" TEXT,
  "type" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "config" TEXT,
  "validation" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostFieldDefinition_postSettingId_fkey" FOREIGN KEY ("postSettingId") REFERENCES "PostSetting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PostFieldDefinition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PostFieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PostFieldDefinition_postSettingId_slug_key" UNIQUE ("postSettingId", "slug")
);

CREATE TABLE "new_Post" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postSettingId" TEXT,
  "title" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'TITLE_ONLY',
  "url" TEXT,
  "contents" TEXT,
  "file" TEXT,
  "detailPageEnabled" INTEGER NOT NULL DEFAULT 0,
  "detailSlug" TEXT,
  "detailBody" TEXT,
  "publishedAt" DATETIME,
  "postedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "categoryId" TEXT,
  "customFields" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  CONSTRAINT "Post_postSettingId_fkey" FOREIGN KEY ("postSettingId") REFERENCES "PostSetting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Post" (
  "id",
  "postSettingId",
  "title",
  "format",
  "url",
  "contents",
  "file",
  "detailPageEnabled",
  "detailSlug",
  "detailBody",
  "publishedAt",
  "postedAt",
  "status",
  "categoryId",
  "customFields",
  "createdAt",
  "updatedAt",
  "createdByUserId",
  "updatedByUserId"
)
SELECT
  "id",
  NULL AS "postSettingId",
  "title",
  "format",
  "url",
  "contents",
  "file",
  "detailPageEnabled",
  NULL AS "detailSlug",
  NULL AS "detailBody",
  "publishedAt",
  COALESCE("publishedAt", "createdAt") AS "postedAt",
  CASE WHEN "publishedAt" IS NOT NULL THEN 'PUBLISHED' ELSE 'DRAFT' END AS "status",
  "categoryId",
  NULL AS "customFields",
  "createdAt",
  "updatedAt",
  "createdByUserId",
  "updatedByUserId"
FROM "Post";

DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";

CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX "Post_postedAt_idx" ON "Post"("postedAt");
CREATE INDEX "Post_publishedAt_idx" ON "Post"("publishedAt");
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");
CREATE INDEX "Post_postSettingId_idx" ON "Post"("postSettingId");
CREATE UNIQUE INDEX "Post_detailSlug_key" ON "Post"("detailSlug");

CREATE INDEX "PostSetting_status_idx" ON "PostSetting"("status");
CREATE INDEX "PostFieldDefinition_postSettingId_order_idx" ON "PostFieldDefinition"("postSettingId", "order");

PRAGMA foreign_keys=ON;
