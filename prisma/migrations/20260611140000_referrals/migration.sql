-- Add referral tracking to participants.
ALTER TABLE "Participant" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "Participant" ADD COLUMN "referredById" TEXT;

UPDATE "Participant" SET "referralCode" = "accessCode" WHERE "referralCode" IS NULL OR "referralCode" = '';

CREATE UNIQUE INDEX "Participant_referralCode_key" ON "Participant"("referralCode");
CREATE INDEX "Participant_referredById_idx" ON "Participant"("referredById");
