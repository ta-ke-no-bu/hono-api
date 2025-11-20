/*
  Warnings:

  - You are about to drop the `CustomFieldSet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `contents` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `detailPageEnabled` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `file` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `format` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `linkLabel` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `appliesTo` on the `PostSetting` table. All the data in the column will be lost.
  - You are about to drop the column `defaultCategoryId` on the `PostSetting` table. All the data in the column will be lost.
  - You are about to drop the column `detailPageRequirement` on the `PostSetting` table. All the data in the column will be lost.
  - You are about to drop the column `detailSlugPrefix` on the `PostSetting` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CustomFieldSet_slug_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CustomFieldSet";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomFieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postSettingId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT,
    "validation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomFieldDefinition_postSettingId_fkey" FOREIGN KEY ("postSettingId") REFERENCES "PostSetting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomFieldDefinition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CustomFieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CustomFieldDefinition" ("config", "createdAt", "description", "id", "label", "order", "parentId", "postSettingId", "slug", "type", "updatedAt", "validation") SELECT "config", "createdAt", "description", "id", "label", "order", "parentId", "postSettingId", "slug", "type", "updatedAt", "validation" FROM "CustomFieldDefinition";
DROP TABLE "CustomFieldDefinition";
ALTER TABLE "new_CustomFieldDefinition" RENAME TO "CustomFieldDefinition";
CREATE INDEX "CustomFieldDefinition_postSettingId_order_idx" ON "CustomFieldDefinition"("postSettingId", "order");
CREATE UNIQUE INDEX "CustomFieldDefinition_postSettingId_slug_key" ON "CustomFieldDefinition"("postSettingId", "slug");
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postSettingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailSlug" TEXT,
    "detailBody" TEXT,
    "publishedAt" DATETIME,
    "postedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "categoryId" TEXT,
    "customFields" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    CONSTRAINT "Post_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_postSettingId_fkey" FOREIGN KEY ("postSettingId") REFERENCES "PostSetting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("categoryId", "createdAt", "createdByUserId", "customFields", "detailBody", "detailSlug", "id", "postSettingId", "postedAt", "publishedAt", "status", "title", "updatedAt", "updatedByUserId") SELECT "categoryId", "createdAt", "createdByUserId", "customFields", "detailBody", "detailSlug", "id", "postSettingId", "postedAt", "publishedAt", "status", "title", "updatedAt", "updatedByUserId" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX "Post_postedAt_idx" ON "Post"("postedAt");
CREATE INDEX "Post_publishedAt_idx" ON "Post"("publishedAt");
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");
CREATE INDEX "Post_postSettingId_idx" ON "Post"("postSettingId");
CREATE UNIQUE INDEX "Post_detailSlug_key" ON "Post"("detailSlug");
CREATE TABLE "new_PostSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    CONSTRAINT "PostSetting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PostSetting_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PostSetting" ("createdAt", "createdByUserId", "description", "id", "name", "slug", "status", "updatedAt", "updatedByUserId") SELECT "createdAt", "createdByUserId", "description", "id", "name", "slug", "status", "updatedAt", "updatedByUserId" FROM "PostSetting";
DROP TABLE "PostSetting";
ALTER TABLE "new_PostSetting" RENAME TO "PostSetting";
CREATE UNIQUE INDEX "PostSetting_slug_key" ON "PostSetting"("slug");
CREATE INDEX "PostSetting_status_idx" ON "PostSetting"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
