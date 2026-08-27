-- AlterEnum
ALTER TYPE "ScrapeJobType" ADD VALUE 'META_ADS_ENRICHMENT';

-- AlterTable
ALTER TABLE "MetaAdBrand" ADD COLUMN     "contactPageUrl" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "enrichmentStatus" "BrandEnrichmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "rawNotes" TEXT,
ADD COLUMN     "websiteConfidence" DOUBLE PRECISION,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateIndex
CREATE INDEX "MetaAdBrand_enrichmentStatus_idx" ON "MetaAdBrand"("enrichmentStatus");
