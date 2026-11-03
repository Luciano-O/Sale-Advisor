-- Names the stores that already exist; mirrors KNOWN_STORES in packages/domain/src/store.ts.
CREATE TEMP TABLE "known_stores" ("domain" varchar(255) PRIMARY KEY, "name" varchar(120) NOT NULL);--> statement-breakpoint
INSERT INTO "known_stores" ("domain", "name") VALUES
	('amazon.com.br', 'Amazon'),
	('mercadolivre.com.br', 'Mercado Livre'),
	('shopee.com.br', 'Shopee'),
	('kabum.com.br', 'KaBuM!'),
	('terabyteshop.com.br', 'Terabyte'),
	('pichau.com.br', 'Pichau'),
	('magazineluiza.com.br', 'Magazine Luiza'),
	('aliexpress.com', 'AliExpress'),
	('patoloco.com.br', 'Pato Loco');--> statement-breakpoint
INSERT INTO "stores" ("domain", "name")
	SELECT k."domain", k."name" FROM "known_stores" k
	WHERE EXISTS (SELECT 1 FROM "stores" s WHERE s."domain" LIKE '%.' || k."domain")
	ON CONFLICT ("domain") DO NOTHING;--> statement-breakpoint
UPDATE "offers" o SET "store_id" = canonical."id", "updated_at" = now()
	FROM "stores" subdomain
	JOIN "known_stores" k ON subdomain."domain" LIKE '%.' || k."domain"
	JOIN "stores" canonical ON canonical."domain" = k."domain"
	WHERE o."store_id" = subdomain."id";--> statement-breakpoint
UPDATE "stores" s SET "name" = k."name", "updated_at" = now()
	FROM "known_stores" k
	WHERE s."domain" = k."domain" AND s."name" = s."domain";--> statement-breakpoint
UPDATE "stores" SET "blocked_at" = now(), "updated_at" = now()
	WHERE "domain" = 'aceleraafiliado.com' AND "blocked_at" IS NULL;--> statement-breakpoint
DROP TABLE "known_stores";
