import { prisma } from "@/lib/prisma";

type AuditPayload = Record<string, string | number | boolean | null | undefined>;

type AuditInput = {
  actor?: string | null;
  event: string;
  payload?: AuditPayload;
  targetId?: string | null;
  targetType?: string | null;
};

function cleanPayload(payload: AuditPayload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

async function sendToGoogle(log: {
  actor: string | null;
  event: string;
  payload: AuditPayload;
  targetId: string | null;
  targetType: string | null;
}) {
  const webhookUrl = process.env.GOOGLE_LOG_WEBHOOK_URL;
  if (!webhookUrl) return "SKIPPED";

  const response = await fetch(webhookUrl, {
    body: JSON.stringify({
      ...log,
      app: "polla-mundialista",
      secret: process.env.GOOGLE_LOG_SECRET ?? "",
      timestamp: new Date().toISOString(),
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  return response.ok ? "SENT" : `ERROR_${response.status}`;
}

export async function logEvent({ actor = null, event, payload = {}, targetId = null, targetType = null }: AuditInput) {
  const safePayload = cleanPayload(payload);
  let googleStatus = "SKIPPED";

  try {
    googleStatus = await sendToGoogle({
      actor,
      event,
      payload: safePayload,
      targetId,
      targetType,
    });
  } catch (error) {
    googleStatus = "ERROR";
    console.error("Google log webhook failed", error);
  }

  await prisma.auditLog.create({
    data: {
      actor,
      event,
      googleStatus,
      payloadJson: JSON.stringify(safePayload),
      targetId,
      targetType,
    },
  });
}
