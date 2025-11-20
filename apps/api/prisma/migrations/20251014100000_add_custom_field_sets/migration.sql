-- CreateTable
CREATE TABLE "CustomFieldSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "appliesTo" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT,
    "validation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomFieldDefinition_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CustomFieldSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomFieldDefinition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CustomFieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'TITLE_ONLY',
    "url" TEXT,
    "linkLabel" TEXT,
    "contents" TEXT,
    "file" TEXT,
    "detailPageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "categoryId" TEXT,
    "customFields" TEXT,
    "customFieldSetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    CONSTRAINT "Post_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_customFieldSetId_fkey" FOREIGN KEY ("customFieldSetId") REFERENCES "CustomFieldSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("id", "title", "format", "url", "linkLabel", "contents", "file", "detailPageEnabled", "publishedAt", "categoryId", "customFields", "customFieldSetId", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId")
SELECT "id", "title", "format", "url", "linkLabel", "contents", "file", "detailPageEnabled", "publishedAt", "categoryId", NULL, NULL, "createdAt", "updatedAt", "createdByUserId", "updatedByUserId" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX "Post_publishedAt_idx" ON "Post"("publishedAt");
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");
CREATE INDEX "Post_customFieldSetId_idx" ON "Post"("customFieldSetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldSet_slug_key" ON "CustomFieldSet"("slug");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_setId_order_idx" ON "CustomFieldDefinition"("setId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_setId_slug_key" ON "CustomFieldDefinition"("setId", "slug");
