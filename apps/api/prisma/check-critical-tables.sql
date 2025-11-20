-- このプロジェクトで必須となるテーブル一覧を管理します。
-- ここに列挙されたテーブルが存在しない場合は、SELECT の結果として不足テーブル名が返るため、
-- CI ではこの結果が空であることを確認してください。
WITH required(name) AS (
  SELECT column1 AS name
  FROM (
    VALUES
      ('User'),
      ('ErrorLog'),
      ('AuditLog'),
      ('AppSetting'),
      ('ContactForm'),
      ('ContactFormRecipient'),
      ('Contact'),
      ('Category'),
      ('Post'),
      ('PostSetting'),
      ('CustomFieldDefinition')
  )
)
SELECT name
FROM required
WHERE NOT EXISTS (
  SELECT 1
  FROM sqlite_master
  WHERE type = 'table'
    AND name = required.name
);
