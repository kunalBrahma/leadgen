-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "bio" TEXT,
    "followerCount" TEXT,
    "recentTweets" JSONB,
    "intentScore" INTEGER,
    "founderScore" INTEGER,
    "buyingPowerScore" INTEGER,
    "painAwarenessScore" INTEGER,
    "actionabilityScore" INTEGER,
    "analysis" TEXT,
    "suggestedIcebreaker" TEXT,
    "isBuyer" BOOLEAN DEFAULT false,
    "searchContext" TEXT,
    "postedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'detected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentConfig" (
    "id" TEXT NOT NULL,
    "targetPersona" TEXT NOT NULL,
    "activeKeywords" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "IntentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedReply" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "suggestedText" TEXT NOT NULL,
    "replyStyle" TEXT NOT NULL,
    "usedInProduction" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_platformPostId_key" ON "Lead"("platformPostId");

-- AddForeignKey
ALTER TABLE "GeneratedReply" ADD CONSTRAINT "GeneratedReply_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
