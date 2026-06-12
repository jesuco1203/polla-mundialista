export const REFERRAL_INVITE_LIMIT = 3;
export const REFERRER_BONUS_POINTS = 3;
export const REFERRED_WELCOME_POINTS = 1;

type ReferralLike = {
  paymentStatus: string;
};

export function eligiblePaidReferralCount(referrals: ReferralLike[]) {
  return Math.min(
    referrals.filter((referral) => referral.paymentStatus === "PAID").length,
    REFERRAL_INVITE_LIMIT,
  );
}

export function getReferralBonus({
  referredById,
  referrals,
}: {
  referredById?: string | null;
  referrals: ReferralLike[];
}) {
  const paidReferralCount = eligiblePaidReferralCount(referrals);
  const referralBonusPoints = paidReferralCount * REFERRER_BONUS_POINTS;
  const welcomeBonusPoints = referredById ? REFERRED_WELCOME_POINTS : 0;

  return {
    paidReferralCount,
    referralBonusPoints,
    totalBonusPoints: referralBonusPoints + welcomeBonusPoints,
    welcomeBonusPoints,
  };
}
