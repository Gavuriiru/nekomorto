CREATE TABLE "user_identities" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerSubject" TEXT NOT NULL,
  "emailNormalized" TEXT NULL,
  "emailVerified" BOOLEAN NULL,
  "displayName" TEXT NULL,
  "avatarUrl" TEXT NULL,
  "linkedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastUsedAt" TIMESTAMPTZ NULL,
  "disabledAt" TIMESTAMPTZ NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_identities_provider_providerSubject_key" ON "user_identities" ("provider", "providerSubject");
CREATE UNIQUE INDEX "user_identities_userId_provider_key" ON "user_identities" ("userId", "provider");
CREATE INDEX "user_identities_userId_idx" ON "user_identities" ("userId");
CREATE INDEX "user_identities_emailNormalized_idx" ON "user_identities" ("emailNormalized");

CREATE TABLE "user_local_auth" (
  "userId" TEXT NOT NULL,
  "emailNormalized" TEXT NULL,
  "usernameNormalized" TEXT NULL,
  "passwordHash" TEXT NOT NULL,
  "passwordUpdatedAt" TIMESTAMPTZ NOT NULL,
  "disabledAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_local_auth_pkey" PRIMARY KEY ("userId")
);
CREATE UNIQUE INDEX "user_local_auth_emailNormalized_key" ON "user_local_auth" ("emailNormalized");
CREATE UNIQUE INDEX "user_local_auth_usernameNormalized_key" ON "user_local_auth" ("usernameNormalized");

CREATE TABLE "user_webauthn_credentials" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" JSONB NULL,
  "backedUp" BOOLEAN NULL,
  "deviceLabel" TEXT NULL,
  "lastUsedAt" TIMESTAMPTZ NULL,
  "revokedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_webauthn_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_webauthn_credentials_credentialId_key" ON "user_webauthn_credentials" ("credentialId");
CREATE INDEX "user_webauthn_credentials_userId_idx" ON "user_webauthn_credentials" ("userId");
CREATE INDEX "user_webauthn_credentials_revokedAt_idx" ON "user_webauthn_credentials" ("revokedAt");

INSERT INTO "user_identities" (
  "id",
  "userId",
  "provider",
  "providerSubject",
  "displayName",
  "linkedAt",
  "data",
  "createdAt",
  "updatedAt"
)
SELECT
  'discord:' || u."id",
  u."id",
  'discord',
  u."id",
  NULL,
  NOW(),
  '{}'::jsonb,
  NOW(),
  NOW()
FROM "users" u
ON CONFLICT ("provider", "providerSubject") DO NOTHING;