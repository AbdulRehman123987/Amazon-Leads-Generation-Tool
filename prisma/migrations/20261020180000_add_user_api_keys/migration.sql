-- AlterTable
-- Each person can store their own scrape.do and SearchAPI.io keys (encrypted by the app).
ALTER TABLE "User" ADD COLUMN     "scrapeDoApiKey" TEXT,
ADD COLUMN     "searchApiKey" TEXT;
