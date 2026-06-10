"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("hospital_token");
    const userStr = localStorage.getItem("hospital_user");

    if (!token || !userStr) {
      router.push("/login");
      return;
    }

    // Call /api/auth/me to verify and fetch fresh roles/employee info
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const fullUser = data.data.user;
          localStorage.setItem("hospital_user", JSON.stringify(fullUser));
          
          if (fullUser.userType === "SUPER_ADMIN") {
            router.push("/super-admin");
          } else {
            const hasAdminRole = fullUser.roles?.some(
              (r: any) => r.name.toLowerCase() === "hospital admin"
            );
            const hasAdminDesignation =
              fullUser.employee?.designation?.toLowerCase().includes("admin");

            if (hasAdminRole || hasAdminDesignation) {
              router.push("/hospital-admin");
            } else {
              router.push("/employee");
            }
          }
        } else {
          router.push("/login");
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#f7f7f4] text-[#20231f]">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#477063] animate-pulse">
          MedFlow SaaS
        </p>
        <h1 className="mt-2 text-xl font-semibold">Loading console...</h1>
      </div>
    </div>
  );
}
