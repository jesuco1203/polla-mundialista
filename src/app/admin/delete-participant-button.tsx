"use client";

import { Trash2 } from "lucide-react";

export function DeleteParticipantButton({ participantName }: { participantName: string }) {
  return (
    <button
      className="danger-button"
      type="submit"
      onClick={(event) => {
        const confirmed = window.confirm(`Eliminar a ${participantName}? Esta accion tambien borrara sus pronosticos.`);
        if (!confirmed) event.preventDefault();
      }}
    >
      <Trash2 size={16} />
      Eliminar
    </button>
  );
}
