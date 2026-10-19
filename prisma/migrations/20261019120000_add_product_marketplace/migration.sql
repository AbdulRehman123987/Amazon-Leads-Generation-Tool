-- CreateEnum
CREATE TYPE "AmazonMarketplace" AS ENUM ('US', 'UK');

-- DropIndex
-- (an ASIN is now unique per marketplace, not globally)
DROP INDEX "Product_asin_key";

-- AlterTable
-- Everything scraped so far came from amazon.com, which is what the default means.
ALTER TABLE "Product" ADD COLUMN "marketplace" "AmazonMarketplace" NOT NULL DEFAULT 'US';

-- CreateIndex
CREATE INDEX "Product_marketplace_idx" ON "Product"("marketplace");

-- CreateIndex
CREATE UNIQUE INDEX "Product_asin_marketplace_key" ON "Product"("asin", "marketplace");
