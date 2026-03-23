CREATE TABLE "webhook_deliveries" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "channel" TEXT,
  "eventKey" TEXT,
  "status" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "targetLabel" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "context" JSONB NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lastStatusCode" INTEGER,
  "lastErrorCode" TEXT,
  "lastError" TEXT,
  "processingOwner" TEXT,
  "processingStartedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "retryOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_deliveries_status_nextAttemptAt_idx"
ON "webhook_deliveries"("status", "nextAttemptAt");

CREATE INDEX "webhook_deliveries_scope_createdAt_idx"
ON "webhook_deliveries"("scope", "createdAt");

CREATE INDEX "webhook_deliveries_channel_createdAt_idx"
ON "webhook_deliveries"("channel", "createdAt");

CREATE INDEX "webhook_deliveries_eventKey_createdAt_idx"
ON "webhook_deliveries"("eventKey", "createdAt");

CREATE INDEX "webhook_deliveries_retryOfId_idx"
ON "webhook_deliveries"("retryOfId");

CREATE TABLE "webhook_state" (
  "key" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "webhook_state_pkey" PRIMARY KEY ("key")
);
