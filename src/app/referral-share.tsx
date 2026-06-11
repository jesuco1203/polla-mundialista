"use client";

import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ReferralShareProps = {
  baseUrl: string;
  code: string;
  name?: string;
  compact?: boolean;
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

export function ReferralShare({ baseUrl, code, name, compact = false }: ReferralShareProps) {
  const [copied, setCopied] = useState<"code" | "link" | "share" | null>(null);
  const inviteLink = `${baseUrl}/?ref=${encodeURIComponent(code)}#registro`;
  const inviteText = useMemo(
    () =>
      `Entra a la Polla Mundialista 2026 con mi codigo ${code}. Inscribete por S/10, pronostica y compite por el pozo: ${inviteLink}`,
    [code, inviteLink],
  );
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(inviteText)}`;

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy(value: string, kind: "code" | "link") {
    await copyText(value);
    setCopied(kind);
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          text: inviteText,
          title: "Polla Mundialista 2026",
          url: inviteLink,
        });
        setCopied("share");
        return;
      }
    } catch {
      return;
    }

    await copyText(inviteText);
    setCopied("share");
  }

  return (
    <div className={compact ? "referral-share compact" : "referral-share"}>
      <div className="referral-code-box">
        <span>{name ? `Codigo de ${name}` : "Tu codigo de referido"}</span>
        <strong>{code}</strong>
      </div>
      <label className="referral-link-box">
        Link para compartir
        <input value={inviteLink} readOnly aria-label={`Link de referido ${code}`} />
      </label>
      <div className="share-actions">
        <button type="button" onClick={() => handleCopy(code, "code")}>
          {copied === "code" ? <Check size={16} /> : <Copy size={16} />}
          {copied === "code" ? "Copiado" : "Copiar codigo"}
        </button>
        <button type="button" onClick={() => handleCopy(inviteLink, "link")}>
          {copied === "link" ? <Check size={16} /> : <Copy size={16} />}
          {copied === "link" ? "Copiado" : "Copiar link"}
        </button>
        <a href={whatsappUrl} target="_blank" rel="noreferrer">
          <MessageCircle size={16} />
          WhatsApp
        </a>
        <button type="button" onClick={handleShare}>
          {copied === "share" ? <Check size={16} /> : <Share2 size={16} />}
          {copied === "share" ? "Listo" : "Compartir"}
        </button>
      </div>
      {!compact ? (
        <p>
          Tambien puedes pegar este link en Instagram, Facebook, TikTok o cualquier grupo. El codigo queda aplicado al
          abrir el registro.
        </p>
      ) : null}
    </div>
  );
}
