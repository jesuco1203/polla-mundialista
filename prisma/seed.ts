import { PrismaClient } from "@prisma/client";
import { scorePrediction } from "../src/lib/scoring";

const prisma = new PrismaClient();

async function main() {
  await prisma.poolConfig.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      name: "Polla Mundialista 2026",
      entryFeeCents: 1000,
      organizerShare: 50,
      winnerShare: 50,
      currency: "PEN",
    },
  });

  const matches = [
    {
      externalId: "sample-001",
      stage: "Grupo A",
      groupName: "A",
      homeTeam: "Mexico",
      awayTeam: "Sudafrica",
      startsAt: new Date("2026-06-11T19:00:00.000Z"),
      venue: "Estadio Azteca",
    },
    {
      externalId: "sample-002",
      stage: "Grupo A",
      groupName: "A",
      homeTeam: "Estados Unidos",
      awayTeam: "Por definir",
      startsAt: new Date("2026-06-12T01:00:00.000Z"),
      venue: "SoFi Stadium",
    },
    {
      externalId: "sample-003",
      stage: "Grupo B",
      groupName: "B",
      homeTeam: "Canada",
      awayTeam: "Por definir",
      startsAt: new Date("2026-06-12T22:00:00.000Z"),
      venue: "BMO Field",
    },
  ];

  for (const match of matches) {
    await prisma.match.upsert({
      where: { externalId: match.externalId },
      update: match,
      create: match,
    });
  }

  const demo = await prisma.participant.upsert({
    where: { accessCode: "DEMO2026" },
    update: {},
    create: {
      name: "Participante Demo",
      phone: "999999999",
      email: "demo@polla.local",
      accessCode: "DEMO2026",
      referralCode: "DEMO2026",
      paymentStatus: "PAID",
      paymentNote: "Semilla local",
    },
  });

  const firstMatch = await prisma.match.findUnique({
    where: { externalId: "sample-001" },
  });

  if (firstMatch) {
    const points = scorePrediction(
      { homeScore: 2, awayScore: 1 },
      { homeScore: firstMatch.homeScore, awayScore: firstMatch.awayScore },
    );

    await prisma.prediction.upsert({
      where: {
        participantId_matchId: {
          participantId: demo.id,
          matchId: firstMatch.id,
        },
      },
      update: { homeScore: 2, awayScore: 1, points },
      create: {
        participantId: demo.id,
        matchId: firstMatch.id,
        homeScore: 2,
        awayScore: 1,
        points,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
