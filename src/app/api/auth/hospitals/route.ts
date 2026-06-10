import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, failure } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get("subdomain");

    if (!subdomain) {
      return success([]);
    }

    const hospital = await prisma.hospital.findFirst({
      where: {
        subdomain: {
          equals: subdomain.trim(),
          mode: "insensitive" as const,
        },
        status: true,
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
        logo: true,
        loginImage1: true,
        loginImage2: true,
        loginImage3: true,
      },
    });

    return success(hospital ? [hospital] : []);
  } catch (error) {
    console.error(error);
    return failure("Failed to fetch hospitals", 500);
  }
}
