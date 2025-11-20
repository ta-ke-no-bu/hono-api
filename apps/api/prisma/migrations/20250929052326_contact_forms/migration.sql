/*
  Warnings:

  - Added the required column `formId` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payload` to the `Contact` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ContactForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "successMessage" TEXT,
    "autoReplyTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "replyToFieldSlug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Insert default form representing legacy contact structure
INSERT INTO "ContactForm" (
    "id",
    "name",
    "slug",
    "description",
    "successMessage",
    "autoReplyTemplate",
    "isActive",
    "replyToFieldSlug",
    "createdAt",
    "updatedAt"
) VALUES (
    'default-form',
    'デフォルトお問い合わせフォーム',
    'default',
    '既存の固定お問い合わせフォーム',
    NULL,
    NULL,
    true,
    'email',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContactFormField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "helpText" TEXT,
    "config" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContactFormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ContactForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Seed default form fields mirroring legacy構成
INSERT INTO "ContactFormField" (
    "id",
    "formId",
    "label",
    "slug",
    "type",
    "isRequired",
    "order",
    "helpText",
    "config",
    "createdAt",
    "updatedAt"
) VALUES
  ('default-field-name', 'default-form', 'お名前', 'name', 'TEXT', 1, 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('default-field-company', 'default-form', '会社名', 'company', 'TEXT', 0, 1, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('default-field-email', 'default-form', 'メールアドレス', 'email', 'EMAIL', 1, 2, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('default-field-telephone', 'default-form', '電話番号', 'telephone', 'TEL', 1, 3, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('default-field-message', 'default-form', 'お問い合わせ内容', 'message', 'TEXTAREA', 0, 4, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "ContactFormRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PRIMARY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactFormRecipient_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ContactForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "emailStatus" TEXT NOT NULL DEFAULT 'sending',
    "resendEmailId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedIp" TEXT,
    "userAgent" TEXT,
    "displayName" TEXT,
    "displayEmail" TEXT,
    "displaySubject" TEXT,
    "name" TEXT,
    "company" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "message" TEXT,
    CONSTRAINT "Contact_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ContactForm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Migrate legacy contact data into new structure referencing default form
INSERT INTO "new_Contact" (
    "id",
    "formId",
    "payload",
    "emailStatus",
    "resendEmailId",
    "createdAt",
    "updatedAt",
    "submittedIp",
    "userAgent",
    "displayName",
    "displayEmail",
    "displaySubject",
    "name",
    "company",
    "email",
    "telephone",
    "message"
)
SELECT
    "id",
    'default-form' AS "formId",
    json_object(
      'name', "name",
      'company', "company",
      'email', "email",
      'telephone', "telephone",
      'message', "message"
    ) AS "payload",
    COALESCE("emailStatus", 'sending') AS "emailStatus",
    "resendEmailId",
    "createdAt",
    "updatedAt",
    NULL,
    NULL,
    "name",
    "email",
    NULL,
    "name",
    "company",
    "email",
    "telephone",
    "message"
FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE UNIQUE INDEX "Contact_resendEmailId_key" ON "Contact"("resendEmailId");
CREATE INDEX "Contact_formId_createdAt_idx" ON "Contact"("formId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ContactForm_slug_key" ON "ContactForm"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ContactFormField_formId_slug_key" ON "ContactFormField"("formId", "slug");
