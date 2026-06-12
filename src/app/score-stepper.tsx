"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

type ScoreStepperProps = {
  homeTeam: string;
  awayTeam: string;
  locked: boolean;
};

function clampScore(value: number) {
  return Math.min(30, Math.max(0, value));
}

function ScoreControl({
  label,
  name,
  initialValue,
  locked,
}: {
  label: string;
  name: string;
  initialValue: number;
  locked: boolean;
}) {
  const [score, setScore] = useState(initialValue);

  return (
    <label className="prediction-score-card">
      <span>{label}</span>
      <div className="score-stepper">
        <button
          aria-label={`Bajar pronostico de ${label}`}
          disabled={locked || score <= 0}
          onClick={() => setScore((current) => clampScore(current - 1))}
          type="button"
        >
          <Minus size={17} />
        </button>
        <input
          aria-label={`Pronostico de ${label}`}
          disabled={locked}
          max="30"
          min="0"
          name={name}
          onChange={(event) => setScore(clampScore(Number(event.target.value) || 0))}
          required
          type="number"
          value={score}
        />
        <button
          aria-label={`Subir pronostico de ${label}`}
          disabled={locked || score >= 30}
          onClick={() => setScore((current) => clampScore(current + 1))}
          type="button"
        >
          <Plus size={17} />
        </button>
      </div>
    </label>
  );
}

export function ScoreStepper({ homeTeam, awayTeam, locked }: ScoreStepperProps) {
  return (
    <div className="prediction-score-grid">
      <ScoreControl initialValue={1} label={homeTeam} locked={locked} name="homeScore" />
      <span className="score-separator" aria-hidden="true">
        -
      </span>
      <ScoreControl initialValue={0} label={awayTeam} locked={locked} name="awayScore" />
    </div>
  );
}
