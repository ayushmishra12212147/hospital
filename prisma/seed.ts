import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { MODULES } from "@/constants/modules";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Seed...");

  // =====================================
  // MODULES
  // =====================================


  for (const appModule of MODULES) {
    await prisma.module.upsert({
      where: {
        code: appModule.code,
      },
      update: {},
      create: appModule,
    });
  }

  console.log("✅ Modules Seeded");

  // =====================================
  // PERMISSIONS
  // =====================================

  const permissions = [
    "hospital.create",
    "hospital.view",
    "hospital.edit",
    "hospital.delete",

    "module.enable",
    "module.disable",

    "user.create",
    "user.view",
    "user.edit",
    "user.delete",

    "role.create",
    "role.view",
    "role.edit",
    "role.delete",

    "patient.create",
    "patient.view",
    "patient.edit",
    "patient.delete",

    "appointment.create",
    "appointment.view",
    "appointment.edit",
    "appointment.delete",

    "billing.create",
    "billing.view",
    "billing.edit",

    "lab.create",
    "lab.view",

    "radiology.create",
    "radiology.view",

    "pharmacy.create",
    "pharmacy.view",

    "report.view",
    "report.export",

    "settings.view",
    "settings.edit",
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permission,
      },
      update: {},
      create: {
        code: permission,
      },
    });
  }

  console.log("✅ Permissions Seeded");

  console.log("🎉 Seed Completed");
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
