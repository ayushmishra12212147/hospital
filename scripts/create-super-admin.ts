

import "dotenv/config";
import { PrismaClient, UserType } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const username = "owner";
    const password = "ChangeMe@123";

    const existingUser = await prisma.user.findFirst({
        where: {
            username,
            userType: UserType.SUPER_ADMIN,
        },
    });

    if (existingUser) {
        console.log("❌ Super Admin already exists");
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
        data: {
            username,
            password: hashedPassword,
            userType: UserType.SUPER_ADMIN,
            isActive: true,
        },
    });

    console.log("✅ Super Admin Created");
    console.log(`Email: ${username}`);
    console.log("⚠️ Change password after first login");
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