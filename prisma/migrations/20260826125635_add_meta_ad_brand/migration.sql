-- AlterEnum
ALTER TYPE "ScrapeJobType" ADD VALUE 'META_ADS_SEARCH';

-- CreateTable
CREATE TABLE "MetaAdBrand" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageProfileUri" TEXT,
    "pageProfilePicture" TEXT,
    "pageLikeCount" INTEGER,
    "pageCategory" TEXT,
    "searchKeyword" TEXT NOT NULL,
    "activeAdCount" INTEGER NOT NULL,
    "sampleAdSnippet" TEXT,
    "scrapeJobId" TEXT NOT NULL,

    CONSTRAINT "MetaAdBrand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaAdBrand_activeAdCount_idx" ON "MetaAdBrand"("activeAdCount");

-- CreateIndex
CREATE INDEX "MetaAdBrand_searchKeyword_idx" ON "MetaAdBrand"("searchKeyword");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdBrand_pageId_searchKeyword_key" ON "MetaAdBrand"("pageId", "searchKeyword");

-- AddForeignKey
ALTER TABLE "MetaAdBrand" ADD CONSTRAINT "MetaAdBrand_scrapeJobId_fkey" FOREIGN KEY ("scrapeJobId") REFERENCES "ScrapeJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
