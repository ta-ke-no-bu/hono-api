PRAGMA foreign_keys=OFF;

INSERT INTO "PostSetting" (
  "id",
  "name",
  "slug",
  "status",
  "description",
  "appliesTo",
  "enableDetailBody",
  "detailPageRequirement",
  "detailSlugPrefix",
  "defaultCategoryId",
  "createdAt",
  "updatedAt",
  "createdByUserId",
  "updatedByUserId"
)
SELECT
  'post-default-setting',
  'デフォルト投稿設定',
  'post-default',
  'ACTIVE',
  '自動移行用の既定投稿設定',
  NULL,
  0,
  'OPTIONAL',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM "PostSetting" WHERE "slug" = 'post-default');

CREATE TABLE "new_Post" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postSettingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'TITLE_ONLY',
  "url" TEXT,
  "linkLabel" TEXT,
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
  CONSTRAINT "Post_postSettingId_fkey" FOREIGN KEY ("postSettingId") REFERENCES "PostSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Post_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Post" (
  "id",
  "postSettingId",
  "title",
  "format",
  "url",
  "linkLabel",
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
  COALESCE(
    "postSettingId",
    (SELECT "id" FROM "PostSetting" WHERE "slug" = 'post-default')
  ),
  "title",
  "format",
  "url",
  "linkLabel",
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
FROM "Post";

DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";

CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX "Post_postedAt_idx" ON "Post"("postedAt");
CREATE INDEX "Post_publishedAt_idx" ON "Post"("publishedAt");
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");
CREATE INDEX "Post_postSettingId_idx" ON "Post"("postSettingId");
CREATE UNIQUE INDEX "Post_detailSlug_key" ON "Post"("detailSlug");

PRAGMA foreign_keys=ON;
