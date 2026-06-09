type Score = {
  homeScore: number | null;
  awayScore: number | null;
};

function outcome(score: { homeScore: number; awayScore: number }) {
  if (score.homeScore > score.awayScore) return "HOME";
  if (score.homeScore < score.awayScore) return "AWAY";
  return "DRAW";
}

export function scorePrediction(
  prediction: { homeScore: number; awayScore: number },
  result: Score,
) {
  if (result.homeScore === null || result.awayScore === null) {
    return 0;
  }

  if (
    prediction.homeScore === result.homeScore &&
    prediction.awayScore === result.awayScore
  ) {
    return 2;
  }

  return outcome(prediction) ===
    outcome({ homeScore: result.homeScore, awayScore: result.awayScore })
    ? 1
    : 0;
}

export function formatMoney(cents: number, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function makeAccessCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
