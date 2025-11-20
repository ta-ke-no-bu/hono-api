-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContactForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "successMessage" TEXT,
    "autoReplyTemplate" TEXT,
    "sendAutoReply" BOOLEAN NOT NULL DEFAULT true,
    "autoReplySubject" TEXT,
    "sendAdminNotification" BOOLEAN NOT NULL DEFAULT true,
    "adminNotificationSubject" TEXT,
    "adminNotificationTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "replyToFieldSlug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ContactForm" ("autoReplyTemplate", "createdAt", "description", "id", "isActive", "name", "replyToFieldSlug", "slug", "successMessage", "updatedAt") SELECT "autoReplyTemplate", "createdAt", "description", "id", "isActive", "name", "replyToFieldSlug", "slug", "successMessage", "updatedAt" FROM "ContactForm";
DROP TABLE "ContactForm";
ALTER TABLE "new_ContactForm" RENAME TO "ContactForm";
CREATE UNIQUE INDEX "ContactForm_slug_key" ON "ContactForm"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
