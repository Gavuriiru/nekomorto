CREATE TABLE "user_sessions" (
  "sid" VARCHAR(255) NOT NULL,
  "sess" JSONB NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX "idx_user_sessions_expire" ON "user_sessions"("expire");
