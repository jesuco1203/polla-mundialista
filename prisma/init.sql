CREATE TABLE IF NOT EXISTS "PoolConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Polla Mundialista 2026',
    "entryFeeCents" INTEGER NOT NULL DEFAULT 1000,
    "organizerShare" INTEGER NOT NULL DEFAULT 50,
    "winnerShare" INTEGER NOT NULL DEFAULT 50,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "accessCode" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "referredById" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Participant_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "stage" TEXT NOT NULL,
    "groupName" TEXT,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "venue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Prediction_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "actor" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "googleStatus" TEXT NOT NULL DEFAULT 'SKIPPED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Participant_accessCode_key" ON "Participant"("accessCode");
CREATE INDEX IF NOT EXISTS "Participant_paymentStatus_idx" ON "Participant"("paymentStatus");
CREATE UNIQUE INDEX IF NOT EXISTS "Match_externalId_key" ON "Match"("externalId");
CREATE INDEX IF NOT EXISTS "Match_startsAt_idx" ON "Match"("startsAt");
CREATE INDEX IF NOT EXISTS "Match_status_idx" ON "Match"("status");
CREATE INDEX IF NOT EXISTS "Prediction_points_idx" ON "Prediction"("points");
CREATE UNIQUE INDEX IF NOT EXISTS "Prediction_participantId_matchId_key" ON "Prediction"("participantId", "matchId");
CREATE INDEX IF NOT EXISTS "AuditLog_event_idx" ON "AuditLog"("event");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
