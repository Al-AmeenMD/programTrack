import { prisma } from "../lib/prisma";

async function main() {
  console.log("Starting Participant Data Migration...");

  const participants = await prisma.participant.findMany();
  console.log(`Found ${participants.length} participant records to migrate.`);

  const migrationReport: Array<{
    id: string;
    original_full_name: string;
    parsed_first_name: string;
    parsed_middle_name: string | null;
    parsed_last_name: string;
    nin_number: string;
  }> = [];

  for (const p of participants) {
    const rawName = (p.full_name || "").trim();
    const parts = rawName.split(/\s+/).filter(Boolean);

    let firstName = "";
    let middleName: string | null = null;
    let lastName = "";

    if (parts.length === 0) {
      firstName = "Unknown";
      lastName = "N/A";
    } else if (parts.length === 1) {
      firstName = parts[0];
      lastName = "N/A";
    } else if (parts.length === 2) {
      firstName = parts[0];
      lastName = parts[1];
    } else {
      firstName = parts[0];
      lastName = parts[parts.length - 1];
      middleName = parts.slice(1, parts.length - 1).join(" ");
    }

    const computedFullName = [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ");
    const ninNumber = (p as { nin_number?: string }).nin_number || "NIN-PENDING";

    await prisma.participant.update({
      where: { id: p.id },
      data: {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        nin_number: ninNumber,
        full_name: computedFullName,
      },
    });

    migrationReport.push({
      id: p.id,
      original_full_name: rawName,
      parsed_first_name: firstName,
      parsed_middle_name: middleName,
      parsed_last_name: lastName,
      nin_number: ninNumber,
    });
  }

  console.log("\n================ MIGRATION REPORT ================");
  console.log(`Total Records Processed: ${migrationReport.length}`);
  console.log("Affected Records:");
  console.table(migrationReport);
  console.log("==================================================\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  prisma.$disconnect();
  process.exit(1);
});
