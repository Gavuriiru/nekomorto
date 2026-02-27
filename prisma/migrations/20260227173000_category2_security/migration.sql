CREATE TABLE "user_mfa_totp" (
  "userId" TEXT NOT NULL,
  "secretEncrypted" TEXT NOT NULL,
  "secretKeyId" TEXT NOT NULL,
  "enabledAt" TIMESTAMPTZ NULL,
  "disabledAt" TIMESTAMPTZ NULL,
  "recoveryCodesHashed" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_mfa_totp_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "user_session_index" (
  "sid" VARCHAR(255) NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastSeenAt" TIMESTAMPTZ NOT NULL,
  "lastIp" TEXT NULL,
  "userAgent" TEXT NULL,
  "revokedAt" TIMESTAMPTZ NULL,
  "revokedBy" TEXT NULL,
  "revokeReason" TEXT NULL,
  "isPendingMfa" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "user_session_index_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX "user_session_index_userId_idx" ON "user_session_index" ("userId");
CREATE INDEX "user_session_index_lastSeenAt_idx" ON "user_session_index" ("lastSeenAt");
CREATE INDEX "user_session_index_revokedAt_idx" ON "user_session_index" ("revokedAt");

CREATE TABLE "security_events" (
  "id" TEXT NOT NULL,
  "ts" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "actorUserId" TEXT NULL,
  "targetUserId" TEXT NULL,
  "ip" TEXT NULL,
  "userAgent" TEXT NULL,
  "sessionId" TEXT NULL,
  "requestId" TEXT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "security_events_ts_idx" ON "security_events" ("ts");
CREATE INDEX "security_events_status_idx" ON "security_events" ("status");
CREATE INDEX "security_events_severity_idx" ON "security_events" ("severity");
CREATE INDEX "security_events_type_idx" ON "security_events" ("type");
CREATE INDEX "security_events_actorUserId_idx" ON "security_events" ("actorUserId");
CREATE INDEX "security_events_targetUserId_idx" ON "security_events" ("targetUserId");

CREATE TABLE "admin_export_jobs" (
  "id" TEXT NOT NULL,
  "dataset" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "filePath" TEXT NULL,
  "rowCount" INTEGER NULL,
  "error" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "startedAt" TIMESTAMPTZ NULL,
  "finishedAt" TIMESTAMPTZ NULL,
  "expiresAt" TIMESTAMPTZ NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "admin_export_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_export_jobs_status_idx" ON "admin_export_jobs" ("status");
CREATE INDEX "admin_export_jobs_createdAt_idx" ON "admin_export_jobs" ("createdAt");
CREATE INDEX "admin_export_jobs_requestedBy_idx" ON "admin_export_jobs" ("requestedBy");

CREATE TABLE "secret_rotations" (
  "id" TEXT NOT NULL,
  "secretFamily" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "rotatedAt" TIMESTAMPTZ NOT NULL,
  "rotatedBy" TEXT NOT NULL,
  "notes" TEXT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "secret_rotations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "secret_rotations_family_rotatedAt_idx" ON "secret_rotations" ("secretFamily", "rotatedAt");
