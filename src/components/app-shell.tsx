"use client";

import type { ReactNode } from "react";

type ShellHospital = {
  id: string;
  name: string;
};

type AppShellProps = {
  username: string;
  userType: string;
  selectedHospitalId: string;
  selectedHospitalName?: string;
  hospitals: ShellHospital[];
  onHospitalChange: (hospitalId: string) => void;
  onLogout: () => void;
  children: ReactNode;
};

const quickNotes = [
  "Patients",
  "Appointments",
  "OPD",
  "Billing",
];

export function AppShell({
  username,
  userType,
  selectedHospitalId,
  selectedHospitalName,
  hospitals,
  onHospitalChange,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#20231f]">
      <header className="border-b border-[#dfe4d9] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#477063]">
              Hospital SaaS
            </p>
            <h1 className="text-2xl font-semibold">
              Operations
            </h1>
            <p className="mt-1 text-sm text-[#687067]">
              {selectedHospitalName ?? "Current hospital"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {userType === "SUPER_ADMIN" ? (
              <select
                value={selectedHospitalId}
                onChange={(event) =>
                  onHospitalChange(event.target.value)
                }
                className="h-10 min-w-64 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              >
                <option value="">
                  Select hospital
                </option>
                {hospitals.map((hospital) => (
                  <option
                    key={hospital.id}
                    value={hospital.id}
                  >
                    {hospital.name}
                  </option>
                ))}
              </select>
            ) : null}

            <span className="rounded-md border border-[#d8ddd3] bg-[#fbfcfa] px-3 py-2 text-sm">
              {username} / {userType}
            </span>
            <button
              onClick={onLogout}
              className="h-10 rounded-md border border-[#cfd6ca] px-4 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-[#e3e7df] bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-5 py-3">
          {quickNotes.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#d8ddd3] bg-[#fbfcfa] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f685c]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-5">
        {children}
      </div>
    </main>
  );
}
