-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'ADMIN');

-- AlterEnum
ALTER TYPE "ScrapeJobStatus" ADD VALUE 'CANCELLED';

-- DropIndex
-- (brands, products and ad-library rows are now unique per user, not globally)
DROP INDEX "Brand_name_key";

-- DropIndex
DROP INDEX "MetaAdBrand_pageId_searchKeyword_key";

-- DropIndex
DROP INDEX "Product_asin_marketplace_key";

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "MetaAdBrand" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "ScrapeJob" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

-- Data: everything that exists today was created before accounts owned
-- anything. The admin account (when it exists) becomes an ADMIN and takes it
-- over, so the other accounts start with their own empty lists. Without that
-- account the rows stay unowned, which only an admin can see.
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'rehmanmirza458@gmail.com';
UPDATE "ScrapeJob" SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'rehmanmirza458@gmail.com');
UPDATE "Product" SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'rehmanmirza458@gmail.com');
UPDATE "Brand" SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'rehmanmirza458@gmail.com');
UPDATE "MetaAdBrand" SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'rehmanmirza458@gmail.com');

-- CreateIndex
CREATE INDEX "Brand_userId_idx" ON "Brand"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_userId_name_key" ON "Brand"("userId", "name");

-- CreateIndex
CREATE INDEX "MetaAdBrand_userId_idx" ON "MetaAdBrand"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdBrand_userId_pageId_searchKeyword_key" ON "MetaAdBrand"("userId", "pageId", "searchKeyword");

-- CreateIndex
CREATE INDEX "Product_userId_idx" ON "Product"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_userId_asin_marketplace_key" ON "Product"("userId", "asin", "marketplace");

-- CreateIndex
CREATE INDEX "ScrapeJob_userId_idx" ON "ScrapeJob"("userId");

-- AddForeignKey
ALTER TABLE "ScrapeJob" ADD CONSTRAINT "ScrapeJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAdBrand" ADD CONSTRAINT "MetaAdBrand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
