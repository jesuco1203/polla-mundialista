"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchWorldCupMatches } from "@/lib/football-api";
import { makeAccessCode, scorePrediction } from "@/lib/scoring";

const participantSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(30),
  email: z.string().trim().email().optional().or(z.literal("")),
});

const predictionSchema = z.object({
  accessCode: z.string().trim().min(4).max(20),
  matchId: z.string().trim().min(1),
  homeScore: z.coerce.number().int().min(0).max(30),
  awayScore: z.coerce.number().int().min(0).max(30),
});

function requireAdminPin(formData: FormData) {
  const expected = process.env.ADMIN_PIN ?? "1234";
  const received = String(formData.get("adminPin") ?? "");

  if (received !== expected) {
    throw new Error("PIN de organizador incorrecto.");
  }
}

export async function registerParticipant(formData: FormData) {
  const parsed = participantSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
  });

  let accessCode = makeAccessCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const exists = await prisma.participant.findUnique({
      where: { accessCode },
      select: { id: true },
    });
    if (!exists) break;
    accessCode = makeAccessCode();
  }

  await prisma.participant.create({
    data: {
      ...parsed,
      email: parsed.email || null,
      accessCode,
    },
  });

  revalidatePath("/");
}

export async function savePrediction(formData: FormData) {
  const parsed = predictionSchema.parse({
    accessCode: formData.get("accessCode"),
    matchId: formData.get("matchId"),
    homeScore: formData.get("homeScore"),
    awayScore: formData.get("awayScore"),
  });

  const participant = await prisma.participant.findUnique({
    where: { accessCode: parsed.accessCode.toUpperCase() },
  });

  if (!participant) {
    throw new Error("No existe un participante con ese codigo.");
  }

  if (participant.paymentStatus !== "PAID") {
    throw new Error("El organizador debe confirmar el pago antes de pronosticar.");
  }

  const match = await prisma.match.findUnique({ where: { id: parsed.matchId } });
  if (!match) throw new Error("Partido no encontrado.");
  if (match.startsAt <= new Date()) {
    throw new Error("Este partido ya esta bloqueado.");
  }

  await prisma.prediction.upsert({
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

  revalidatePath("/");
}

export async function markPayment(formData: FormData) {
  requireAdminPin(formData);

  const participantId = String(formData.get("participantId") ?? "");
  const paymentStatus = String(formData.get("paymentStatus") ?? "PENDING");
  const paymentNote = String(formData.get("paymentNote") ?? "");

  await prisma.participant.update({
    where: { id: participantId },
    data: {
      paymentStatus,
      paymentNote: paymentNote || null,
    },
  });

  revalidatePath("/");
}

export async function updateMatchResult(formData: FormData) {
  requireAdminPin(formData);

  const matchId = String(formData.get("matchId") ?? "");
  const homeScore = z.coerce.number().int().min(0).max(30).parse(formData.get("homeScore"));
  const awayScore = z.coerce.number().int().min(0).max(30).parse(formData.get("awayScore"));

  await prisma.match.update({
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

  revalidatePath("/");
}
