"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/audit-log";
import { fetchWorldCupMatches } from "@/lib/football-api";
import { getGoogleSession } from "@/lib/google-auth";
import { makeAccessCode, scorePrediction } from "@/lib/scoring";

const participantSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(30),
  email: z.string().trim().email().optional().or(z.literal("")),
  referralCode: z.string().trim().max(20).optional().or(z.literal("")),
});

const predictionSchema = z.object({
  accessCode: z.string().trim().max(20).optional().or(z.literal("")),
  matchId: z.string().trim().min(1),
  homeScore: z.coerce.number().int().min(0).max(30),
  awayScore: z.coerce.number().int().min(0).max(30),
});

const matchSchema = z.object({
  stage: z.string().trim().min(2).max(80),
  groupName: z.string().trim().max(10).optional().or(z.literal("")),
  homeTeam: z.string().trim().min(2).max(80),
  awayTeam: z.string().trim().min(2).max(80),
  startsAt: z.string().trim().min(10),
  venue: z.string().trim().max(120).optional().or(z.literal("")),
});

function requireAdminPin(formData: FormData) {
  const expected = process.env.ADMIN_PIN;
  const received = String(formData.get("adminPin") ?? "");

  if (!expected) {
    throw new Error("Falta configurar ADMIN_PIN en el servidor.");
  }

  if (received !== expected) {
    throw new Error("PIN de organizador incorrecto.");
  }
}

async function makeUniqueParticipantCode(field: "accessCode" | "referralCode") {
  let code = makeAccessCode();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const exists = await prisma.participant.findFirst({
      where: { [field]: code },
      select: { id: true },
    });
    if (!exists) return code;
    code = makeAccessCode();
  }

  throw new Error("No se pudo generar un codigo unico. Intenta otra vez.");
}

function normalizeCode(code: string | undefined) {
  return code?.trim().toUpperCase() || "";
}

export async function registerParticipant(formData: FormData) {
  const parsed = participantSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    referralCode: formData.get("referralCode") || undefined,
  });

  const accessCode = await makeUniqueParticipantCode("accessCode");
  const referralCode = await makeUniqueParticipantCode("referralCode");
  const normalizedReferralCode = normalizeCode(parsed.referralCode);
  const referrer = normalizedReferralCode
    ? await prisma.participant.findUnique({
        where: { referralCode: normalizedReferralCode },
        select: { id: true },
      })
    : null;

  if (normalizedReferralCode && !referrer) {
    await logEvent({
      actor: parsed.phone,
      event: "referral.invalid",
      payload: {
        attemptedReferralCode: normalizedReferralCode,
        name: parsed.name,
        phone: parsed.phone,
      },
      targetType: "Participant",
    });
    redirect(`/?ref=${encodeURIComponent(normalizedReferralCode)}&referralError=invalid#registro`);
  }

  const participant = await prisma.participant.create({
    data: {
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email || null,
      accessCode,
      referralCode,
      referredById: referrer?.id ?? null,
    },
  });

  await logEvent({
    actor: participant.phone,
    event: "participant.registered",
    payload: {
      email: participant.email,
      name: participant.name,
      phone: participant.phone,
      referralCode: participant.referralCode,
      referredById: participant.referredById,
      usedReferralCode: normalizedReferralCode || null,
    },
    targetId: participant.id,
    targetType: "Participant",
  });

  revalidatePath("/");
  redirect(`/?registered=${encodeURIComponent(participant.referralCode)}#registro`);
}

export async function savePrediction(formData: FormData) {
  const parsed = predictionSchema.parse({
    accessCode: formData.get("accessCode"),
    matchId: formData.get("matchId"),
    homeScore: formData.get("homeScore"),
    awayScore: formData.get("awayScore"),
  });

  const accessCode = normalizeCode(parsed.accessCode);
  const googleSession = accessCode ? null : await getGoogleSession();
  const participant = accessCode
    ? await prisma.participant.findUnique({
        where: { accessCode },
      })
    : googleSession?.email
      ? await prisma.participant.findFirst({
          where: { email: { equals: googleSession.email } },
        })
      : null;

  if (!participant) {
    throw new Error("No encontramos tu inscripcion. Entra con Google o usa tu codigo.");
  }

  if (participant.paymentStatus !== "PAID") {
    throw new Error("El organizador debe confirmar el pago antes de pronosticar.");
  }

  const match = await prisma.match.findUnique({ where: { id: parsed.matchId } });
  if (!match) throw new Error("Partido no encontrado.");
  if (match.startsAt <= new Date()) {
    throw new Error("Este partido ya esta bloqueado.");
  }

  const prediction = await prisma.prediction.upsert({
    where: {
      participantId_matchId: {
        participantId: participant.id,
        matchId: match.id,
      },
    },
    update: {
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
    },
    create: {
      participantId: participant.id,
      matchId: match.id,
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
    },
  });

  await logEvent({
    actor: participant.referralCode,
    event: "prediction.saved",
    payload: {
      awayScore: prediction.awayScore,
      homeScore: prediction.homeScore,
      match: `${match.homeTeam} vs ${match.awayTeam}`,
      matchStartsAt: match.startsAt.toISOString(),
      participantName: participant.name,
    },
    targetId: prediction.id,
    targetType: "Prediction",
  });

  revalidatePath("/");
}

export async function markPayment(formData: FormData) {
  requireAdminPin(formData);

  const participantId = String(formData.get("participantId") ?? "");
  const paymentStatus = String(formData.get("paymentStatus") ?? "PENDING");
  const paymentNote = String(formData.get("paymentNote") ?? "");

  const previous = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true, name: true, paymentStatus: true, referralCode: true },
  });
  const participant = await prisma.participant.update({
    where: { id: participantId },
    data: {
      paymentStatus,
      paymentNote: paymentNote || null,
    },
  });

  await logEvent({
    actor: "organizer",
    event: "payment.updated",
    payload: {
      name: participant.name,
      newStatus: participant.paymentStatus,
      note: participant.paymentNote,
      previousStatus: previous?.paymentStatus ?? null,
      referralCode: participant.referralCode,
    },
    targetId: participant.id,
    targetType: "Participant",
  });

  revalidatePath("/");
}

export async function createMatch(formData: FormData) {
  requireAdminPin(formData);

  const parsed = matchSchema.parse({
    stage: formData.get("stage"),
    groupName: formData.get("groupName"),
    homeTeam: formData.get("homeTeam"),
    awayTeam: formData.get("awayTeam"),
    startsAt: formData.get("startsAt"),
    venue: formData.get("venue"),
  });

  const startsAt = new Date(parsed.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("Fecha de partido invalida.");
  }

  const match = await prisma.match.create({
    data: {
      stage: parsed.stage,
      groupName: parsed.groupName || null,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      startsAt,
      venue: parsed.venue || null,
    },
  });

  await logEvent({
    actor: "organizer",
    event: "match.created",
    payload: {
      awayTeam: match.awayTeam,
      homeTeam: match.homeTeam,
      stage: match.stage,
      startsAt: match.startsAt.toISOString(),
      venue: match.venue,
    },
    targetId: match.id,
    targetType: "Match",
  });

  revalidatePath("/");
}

export async function updateMatchResult(formData: FormData) {
  requireAdminPin(formData);

  const matchId = String(formData.get("matchId") ?? "");
  const homeScore = z.coerce.number().int().min(0).max(30).parse(formData.get("homeScore"));
  const awayScore = z.coerce.number().int().min(0).max(30).parse(formData.get("awayScore"));

  const match = await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore,
      awayScore,
      status: "FINISHED",
    },
  });

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    select: { id: true, homeScore: true, awayScore: true },
  });

  await Promise.all(
    predictions.map((prediction) =>
      prisma.prediction.update({
        where: { id: prediction.id },
        data: {
          points: scorePrediction(prediction, { homeScore, awayScore }),
        },
      }),
    ),
  );

  await logEvent({
    actor: "organizer",
    event: "match.result.closed",
    payload: {
      awayScore,
      awayTeam: match.awayTeam,
      homeScore,
      homeTeam: match.homeTeam,
      predictionsScored: predictions.length,
    },
    targetId: match.id,
    targetType: "Match",
  });

  revalidatePath("/");
}

export async function syncMatches(formData: FormData) {
  requireAdminPin(formData);
  const matches = await fetchWorldCupMatches();

  for (const match of matches) {
    await prisma.match.upsert({
      where: { externalId: match.externalId },
      update: match,
      create: match,
    });
  }

  await logEvent({
    actor: "organizer",
    event: "matches.synced",
    payload: {
      count: matches.length,
    },
    targetType: "Match",
  });

  revalidatePath("/");
}

export async function testGoogleLogging(formData: FormData) {
  requireAdminPin(formData);

  await logEvent({
    actor: "organizer",
    event: "audit.google_test",
    payload: {
      googleWebhookConfigured: Boolean(process.env.GOOGLE_LOG_WEBHOOK_URL),
      source: "admin-panel",
    },
    targetType: "System",
  });

  revalidatePath("/");
}
