-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ScrapeJobType" AS ENUM ('AMAZON_SEARCH', 'BRAND_ENRICHMENT');

-- CreateEnum
CREATE TYPE "ScrapeJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BrandEnrichmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'FOUND', 'PARTIAL', 'NOT_FOUND');

-- CreateTable
CREATE TABLE "ScrapeJob" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "ScrapeJobType" NOT NULL,
    "status" "ScrapeJobStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "logs" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "asin" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT,
    "reviewCount" INTEGER,
    "rating" DOUBLE PRECISION,
    "bsr" INTEGER,
    "category" TEXT,
    "brandNameRaw" TEXT,
    "lowSaleScore" DOUBLE PRECISION,
    "scrapeJobId" TEXT NOT NULL,
    "brandId" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "websiteConfidence" DOUBLE PRECISION,
    "email" TEXT,
    "phone" TEXT,
    "contactPageUrl" TEXT,
    "enrichmentStatus" "BrandEnrichmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "rawNotes" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapeJob_status_idx" ON "ScrapeJob"("status");

-- CreateIndex
CREATE INDEX "ScrapeJob_type_idx" ON "ScrapeJob"("type");

-- CreateIndex
CREATE INDEX "ScrapeJob_createdAt_idx" ON "ScrapeJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_asin_key" ON "Product"("asin");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_scrapeJobId_idx" ON "Product"("scrapeJobId");

-- CreateIndex
CREATE INDEX "Product_lowSaleScore_idx" ON "Product"("lowSaleScore");

-- CreateIndex
CREATE INDEX "Product_reviewCount_idx" ON "Product"("reviewCount");

-- CreateIndex
CREATE INDEX "Product_bsr_idx" ON "Product"("bsr");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Brand_enrichmentStatus_idx" ON "Brand"("enrichmentStatus");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_scrapeJobId_fkey" FOREIGN KEY ("scrapeJobId") REFERENCES "ScrapeJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

