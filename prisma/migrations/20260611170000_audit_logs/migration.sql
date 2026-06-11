CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "actor" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "googleStatus" TEXT NOT NULL DEFAULT 'SKIPPED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AuditLog_event_idx" ON "AuditLog"("event");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
