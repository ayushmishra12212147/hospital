"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Surface } from "@/components/ui/surface";

type Hospital = {
  id: string;
  name: string;
  subdomain: string;
  status: boolean;
  logo?: string | null;
  loginImage1?: string | null;
  loginImage2?: string | null;
  loginImage3?: string | null;
  createdAt: string;
};

const getHospitalUrl = (subdomain: string) => {
  if (typeof window === "undefined") return "";
  const host = window.location.host;
  const protocol = window.location.protocol;
  const parts = host.split(".");
  if (parts[parts.length - 1] === "localhost" || parts[0].includes("localhost")) {
    return `${protocol}//${subdomain}.localhost:${window.location.port || "3000"}`;
  }
  const baseDomain = parts.slice(-2).join(".");
  return `${protocol}//${subdomain}.${baseDomain}`;
};

type Module = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
};

type HospitalModuleAssignment = {
  id: string;
  enabled: boolean;
  module: Module;
};

type Stats = {
  totalHospitals: number;
  activeHospitals: number;
  disabledHospitals: number;
  totalUsers: number;
  totalPatients: number;
  totalAppointments: number;
};

type RecentAdmin = {
  id: string;
  username: string;
  fullName: string;
  hospitalName: string;
  createdAt: string;
};

type HospitalUser = {
  id: string;
  username: string;
  isActive: boolean;
  employee?: {
    fullName: string;
    designation: string;
    employeeCode: string;
  } | null;
};

export default function SuperAdminPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<any>(null);

  // Nav state
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, hospitals, modules, users, settings

  // Dashboard Stats
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentHospitals, setRecentHospitals] = useState<Hospital[]>([]);
  const [recentAdmins, setRecentAdmins] = useState<RecentAdmin[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Hospital management state
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [hospitalForm, setHospitalForm] = useState({ name: "", subdomain: "", status: true, logo: "", loginImage1: "", loginImage2: "", loginImage3: "" });
  const [isSavingHospital, setIsSavingHospital] = useState(false);
  const [hospitalMsg, setHospitalMsg] = useState("");
  const [hospitalErr, setHospitalErr] = useState("");
  const [hospitalSearch, setHospitalSearch] = useState("");

  // Detailed Hospital View State
  const [hospitalUsers, setHospitalUsers] = useState<HospitalUser[]>([]);
  const [isLoadingHospitalUsers, setIsLoadingHospitalUsers] = useState(false);
  const [assignedModuleIds, setAssignedModuleIds] = useState<string[]>([]);
  const [isSavingModules, setIsSavingModules] = useState(false);
  const [moduleCatalog, setModuleCatalog] = useState<Module[]>([]);

  // Create Hospital Admin state
  const [adminForm, setAdminForm] = useState({
    username: "",
    password: "",
    fullName: "",
    employeeCode: "",
  });
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");
  const [adminErr, setAdminErr] = useState("");

  // Users tab state
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Super Admin Password Change States
  const [ownPassword, setOwnPassword] = useState("");
  const [ownPasswordConfirm, setOwnPasswordConfirm] = useState("");
  const [isSavingOwnPassword, setIsSavingOwnPassword] = useState(false);
  const [ownPasswordMsg, setOwnPasswordMsg] = useState("");
  const [ownPasswordErr, setOwnPasswordErr] = useState("");

  const handleChangeOwnPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !user?.id) return;
    if (ownPassword !== ownPasswordConfirm) {
      setOwnPasswordErr("Passwords do not match");
      return;
    }
    setIsSavingOwnPassword(true);
    setOwnPasswordMsg("");
    setOwnPasswordErr("");
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: ownPassword }),
      });
      const data = await res.json();
      if (!data.success) {
        setOwnPasswordErr(data.message);
      } else {
        setOwnPasswordMsg("Password updated successfully!");
        setOwnPassword("");
        setOwnPasswordConfirm("");
      }
    } catch (err) {
      console.error(err);
      setOwnPasswordErr("Failed to update password.");
    } finally {
      setIsSavingOwnPassword(false);
    }
  };

  const handleResetUserPassword = async (userId: string, username: string) => {
    if (!token) return;
    const confirmReset = window.confirm(`Are you sure you want to reset the password for "${username}" to the default "ChangeMe@123"?`);
    if (!confirmReset) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: "ChangeMe@123" }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Password for "${username}" has been successfully reset to "ChangeMe@123".`);
      } else {
        alert(`Failed to reset password: ${data.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to reset password due to connection error.");
    }
  };

  // Patients global tab state
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientFilterHospitalId, setPatientFilterHospitalId] = useState("");
  const [patientPage, setPatientPage] = useState(1);
  const [patientPagination, setPatientPagination] = useState<any>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  const fetchPatientsGlobal = useCallback(async (authToken: string, searchVal = "", hospId = "", pageNum = 1) => {
    setIsLoadingPatients(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: "10",
        search: searchVal,
        hospitalId: hospId,
      });
      const res = await fetch(`/api/patients?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setPatients(data.data.patients);
        setPatientPagination(data.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPatients(false);
    }
  }, []);

  // Sync effect to load patients when tab/filters change
  useEffect(() => {
    if (token && activeTab === "patients") {
      fetchPatientsGlobal(token, patientSearch, patientFilterHospitalId, patientPage);
    }
  }, [token, activeTab, patientSearch, patientFilterHospitalId, patientPage, fetchPatientsGlobal]);


  // Auth Guard
  useEffect(() => {
    const savedToken = localStorage.getItem("hospital_token");
    const savedUserStr = localStorage.getItem("hospital_user");

    if (!savedToken || !savedUserStr) {
      router.push("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(savedUserStr);
      if (parsedUser.userType !== "SUPER_ADMIN") {
        router.push("/login");
        return;
      }
      setToken(savedToken);
      setUser(parsedUser);
    } catch {
      router.push("/login");
    }
  }, [router]);

  // Fetch Super Admin Stats
  const fetchStats = useCallback(async (authToken: string) => {
    setIsLoadingStats(true);
    try {
      const res = await fetch("/api/super-admin/stats", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data.stats);
        setRecentHospitals(data.data.recentHospitals);
        setRecentAdmins(data.data.recentAdmins);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Fetch Hospitals list
  const fetchHospitals = useCallback(async (authToken: string) => {
    setIsLoadingHospitals(true);
    try {
      const res = await fetch("/api/hospitals", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setHospitals(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHospitals(false);
    }
  }, []);

  // Fetch Modules catalog
  const fetchModuleCatalog = useCallback(async (authToken: string) => {
    try {
      const res = await fetch("/api/modules", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setModuleCatalog(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch all users across the platform
  const fetchAllUsers = useCallback(async (authToken: string, hId?: string) => {
    setIsLoadingAllUsers(true);
    try {
      // In the database model, fetching users requires a hospital ID.
      // So we will map over all hospitals or load users for selectedHospital.
      // For general "Users" tab, let's fetch for the selected hospital or first active hospital.
      const targetHospital = hId || selectedHospital?.id || (hospitals[0]?.id);
      if (!targetHospital) {
        setAllUsers([]);
        return;
      }
      const res = await fetch(`/api/users?hospitalId=${targetHospital}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setAllUsers(data.data.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAllUsers(false);
    }
  }, [hospitals, selectedHospital]);

  // Load Initial Data
  useEffect(() => {
    if (token) {
      fetchStats(token);
      fetchHospitals(token);
      fetchModuleCatalog(token);
    }
  }, [token, fetchStats, fetchHospitals, fetchModuleCatalog]);

  // Handle Tab Switch
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setHospitalMsg("");
    setHospitalErr("");
    setAdminMsg("");
    setAdminErr("");
    if (token) {
      if (tab === "dashboard") fetchStats(token);
      if (tab === "hospitals") fetchHospitals(token);
      if (tab === "users") fetchAllUsers(token);
    }
  };

  // Open Hospital Details
  const handleOpenHospitalDetails = async (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setHospitalForm({
      name: hospital.name,
      subdomain: hospital.subdomain,
      status: hospital.status,
      logo: hospital.logo || "",
      loginImage1: hospital.loginImage1 || "",
      loginImage2: hospital.loginImage2 || "",
      loginImage3: hospital.loginImage3 || "",
    });
    setAdminForm({ username: "", password: "", fullName: "", employeeCode: "" });
    setHospitalMsg("");
    setHospitalErr("");
    setAdminMsg("");
    setAdminErr("");

    if (!token) return;
    
    // Fetch Modules for this hospital
    setIsSavingModules(true);
    try {
      const res = await fetch(`/api/hospitals/${hospital.id}/modules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAssignedModuleIds(
          data.data.filter((item: any) => item.enabled).map((item: any) => item.module.id)
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingModules(false);
    }

    // Fetch Users for this hospital
    setIsLoadingHospitalUsers(true);
    try {
      const res = await fetch(`/api/users?hospitalId=${hospital.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setHospitalUsers(data.data.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHospitalUsers(false);
    }
  };

  // Create or Edit Hospital
  const handleSaveHospital = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSavingHospital(true);
    setHospitalErr("");
    setHospitalMsg("");

    const payload = {
      name: hospitalForm.name.trim(),
      subdomain: hospitalForm.subdomain.trim().toLowerCase(),
      status: hospitalForm.status,
      logo: hospitalForm.logo ? hospitalForm.logo.trim() : null,
      loginImage1: hospitalForm.loginImage1 ? hospitalForm.loginImage1.trim() : null,
      loginImage2: hospitalForm.loginImage2 ? hospitalForm.loginImage2.trim() : null,
      loginImage3: hospitalForm.loginImage3 ? hospitalForm.loginImage3.trim() : null,
    };

    try {
      const res = await fetch(
        selectedHospital ? `/api/hospitals/${selectedHospital.id}` : "/api/hospitals",
        {
          method: selectedHospital ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();

      if (!data.success) {
        setHospitalErr(data.message);
        setIsSavingHospital(false);
        return;
      }

      setHospitalMsg(selectedHospital ? "Hospital updated successfully" : "Hospital created successfully");
      
      // If new hospital, select it
      if (!selectedHospital) {
        handleOpenHospitalDetails(data.data);
      } else {
        setSelectedHospital(data.data);
      }
      
      await fetchHospitals(token);
      await fetchStats(token);
    } catch (err) {
      console.error(err);
      setHospitalErr("Failed to save hospital details.");
    } finally {
      setIsSavingHospital(false);
    }
  };

  // Module checklist toggle
  const handleToggleModule = (moduleId: string) => {
    setAssignedModuleIds((curr) =>
      curr.includes(moduleId) ? curr.filter((id) => id !== moduleId) : [...curr, moduleId]
    );
  };

  // Save Modules assignments
  const handleSaveModules = async () => {
    if (!selectedHospital || !token) return;
    setIsSavingModules(true);
    setHospitalMsg("");
    setHospitalErr("");

    try {
      const res = await fetch(`/api/hospitals/${selectedHospital.id}/modules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ moduleIds: assignedModuleIds }),
      });
      const data = await res.json();
      if (!data.success) {
        setHospitalErr(data.message);
      } else {
        setHospitalMsg("Modules updated successfully");
      }
    } catch (err) {
      console.error(err);
      setHospitalErr("Failed to update modules.");
    } finally {
      setIsSavingModules(false);
    }
  };

  // Create Hospital Admin Account
  const handleCreateHospitalAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedHospital || !token) return;

    setIsCreatingAdmin(true);
    setAdminMsg("");
    setAdminErr("");

    try {
      // 1. Create the user & employee profile
      const userRes = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hospitalId: selectedHospital.id,
          username: adminForm.username.trim(),
          password: adminForm.password.trim(),
          employeeCode: adminForm.employeeCode.trim() || `ADM-${Date.now().toString().slice(-4)}`,
          fullName: adminForm.fullName.trim(),
          designation: "Hospital Admin",
          department: "Administration",
        }),
      });
      
      const userData = await userRes.json();
      if (!userData.success) {
        setAdminErr(userData.message);
        setIsCreatingAdmin(false);
        return;
      }

      const userId = userData.data.user.id;

      // 2. Ensure "Hospital Admin" role exists for this hospital
      const rolesRes = await fetch(`/api/roles?hospitalId=${selectedHospital.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rolesData = await rolesRes.json();
      let adminRole = rolesData.data?.roles?.find((r: any) => r.name === "Hospital Admin");

      if (!adminRole) {
        // Create Role
        const createRoleRes = await fetch("/api/roles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            hospitalId: selectedHospital.id,
            name: "Hospital Admin",
          }),
        });
        const createRoleData = await createRoleRes.json();
        adminRole = createRoleData.data;

        // Assign all permissions to this role
        const permissionsRes = await fetch("/api/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const permissionsData = await permissionsRes.json();
        const pIds = permissionsData.data?.map((p: any) => p.id) || [];

        if (adminRole && pIds.length > 0) {
          await fetch(`/api/roles/${adminRole.id}/permissions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ permissionIds: pIds }),
          });
        }
      }

      // 3. Assign role to the user
      if (adminRole) {
        await fetch(`/api/users/${userId}/roles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roleId: adminRole.id }),
        });
      }

      setAdminMsg("Hospital Admin login credentials created successfully!");
      setAdminForm({ username: "", password: "", fullName: "", employeeCode: "" });
      
      // Refresh user list
      const usersRes = await fetch(`/api/users?hospitalId=${selectedHospital.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const usersData = await usersRes.json();
      if (usersData.success) {
        setHospitalUsers(usersData.data.users);
      }
    } catch (err) {
      console.error(err);
      setAdminErr("Failed to setup hospital admin credentials.");
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  // Toggle user active status
  const handleToggleUserActive = async (targetUser: HospitalUser) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !targetUser.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        if (selectedHospital) {
          // Refresh list for hospital
          setHospitalUsers((curr) =>
            curr.map((u) => (u.id === targetUser.id ? { ...u, isActive: data.data.isActive } : u))
          );
        } else {
          // General list
          setAllUsers((curr) =>
            curr.map((u) => (u.id === targetUser.id ? { ...u, isActive: data.data.isActive } : u))
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("hospital_token");
    localStorage.removeItem("hospital_user");
    router.push("/login");
  };

  // Filter hospitals by search query
  const filteredHospitals = hospitals.filter((h) => {
    const q = hospitalSearch.toLowerCase().trim();
    return h.name.toLowerCase().includes(q) || h.subdomain.toLowerCase().includes(q);
  });

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#20231f] flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#dfe4d9] bg-white flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-[#dfe4d9]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#477063]">
              MedFlow SaaS
            </p>
            <h1 className="text-xl font-bold mt-1 text-[#151917]">Super Admin</h1>
          </div>

          <nav className="p-4 space-y-1">
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "hospitals", label: "Hospitals" },
              { id: "modules", label: "System Modules" },
              { id: "patients", label: "Patients Directory" },
              { id: "users", label: "Platform Users" },
              { id: "settings", label: "Settings" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                  activeTab === tab.id
                    ? "bg-[#eef3eb] text-[#2f5d50]"
                    : "text-[#626a62] hover:bg-[#f3f5f0] hover:text-[#20231f]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-[#dfe4d9] flex flex-col gap-2">
          <div className="text-xs text-[#626a62] px-4">
            Logged in as <span className="font-semibold text-[#20231f]">{user?.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm font-semibold text-red-600 rounded-md hover:bg-red-50 transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Tab 1: Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Platform Dashboard</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Real-time SaaS operational summary across all hospital tenants.
              </p>
            </div>

            {isLoadingStats ? (
              <div className="text-center py-12 text-[#626a62]">Loading platform stats...</div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                  {[
                    { label: "Total Hospitals", val: stats?.totalHospitals ?? 0, bg: "bg-white" },
                    { label: "Active", val: stats?.activeHospitals ?? 0, bg: "bg-[#eef8f1] text-[#27603a] border-[#d2edd9]" },
                    { label: "Disabled", val: stats?.disabledHospitals ?? 0, bg: "bg-[#fff0ef] text-[#9f2d24] border-[#fcdad7]" },
                    { label: "Total Users", val: stats?.totalUsers ?? 0, bg: "bg-white" },
                    { label: "Total Patients", val: stats?.totalPatients ?? 0, bg: "bg-white" },
                    { label: "Total Appointments", val: stats?.totalAppointments ?? 0, bg: "bg-white" },
                  ].map((card, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border border-[#d8ddd3] shadow-sm flex flex-col justify-between h-24 ${card.bg}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#626a62]">
                        {card.label}
                      </p>
                      <p className="text-2xl font-bold tracking-tight">{card.val}</p>
                    </div>
                  ))}
                </div>

                {/* Recent Activity lists */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Recently Created Hospitals */}
                  <Surface title="Recently Created Hospitals" description="Latest 5 hospitals registered on the SaaS.">
                    <div className="divide-y divide-[#dfe4d9]">
                      {recentHospitals.length === 0 ? (
                        <p className="py-4 text-sm text-[#626a62]">No hospitals found.</p>
                      ) : (
                        recentHospitals.map((h) => (
                          <div key={h.id} className="py-3 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{h.name}</p>
                              <p className="text-xs text-[#626a62]">
                                Subdomain:{" "}
                                <a
                                  href={getHospitalUrl(h.subdomain)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#2f5d50] hover:underline font-semibold"
                                >
                                  {h.subdomain}.medflow.com
                                </a>
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${h.status ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                              {h.status ? "Active" : "Disabled"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </Surface>

                  {/* Recently Created Admins */}
                  <Surface title="Recently Configured Admins" description="Latest 5 hospital owner logins created.">
                    <div className="divide-y divide-[#dfe4d9]">
                      {recentAdmins.length === 0 ? (
                        <p className="py-4 text-sm text-[#626a62]">No admins created yet.</p>
                      ) : (
                        recentAdmins.map((adm) => (
                          <div key={adm.id} className="py-3 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{adm.fullName}</p>
                              <p className="text-xs text-[#626a62]">Username: {adm.username} / Hospital: {adm.hospitalName}</p>
                            </div>
                            <span className="text-xs text-[#626a62]">
                              {new Date(adm.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </Surface>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Hospitals */}
        {activeTab === "hospitals" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#151917]">Hospital Tenants Management</h2>
                <p className="text-sm text-[#626a62] mt-1">
                  Configure hospital profiles, reserve subdomains, enable module packages, and setup credentials.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedHospital(null);
                  setHospitalForm({ name: "", subdomain: "", status: true, logo: "", loginImage1: "", loginImage2: "", loginImage3: "" });
                  setHospitalMsg("");
                  setHospitalErr("");
                }}
                className="h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition"
              >
                + Register Hospital
              </button>
            </div>

            <div className="grid xl:grid-cols-[400px_1fr] gap-6">
              {/* Left Column: Hospital List */}
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Search hospitals..."
                  value={hospitalSearch}
                  onChange={(e) => setHospitalSearch(e.target.value)}
                  className="w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                />

                {isLoadingHospitals ? (
                  <div className="text-center py-8 text-[#626a62]">Loading hospitals list...</div>
                ) : filteredHospitals.length === 0 ? (
                  <div className="text-center py-8 text-[#626a62]">No hospitals found.</div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredHospitals.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => handleOpenHospitalDetails(h)}
                        className={`w-full text-left p-4 rounded-lg border transition ${
                          selectedHospital?.id === h.id
                            ? "bg-[#eef3eb] border-[#477063]"
                            : "bg-white border-[#d8ddd3] hover:bg-[#f3f5f0]"
                        }`}
                      >
                        <p className="font-semibold text-sm">{h.name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-[#626a62]">
                            Subdomain:{" "}
                            <a
                              href={getHospitalUrl(h.subdomain)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#2f5d50] hover:underline font-semibold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {h.subdomain}.medflow.com
                            </a>
                          </span>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${h.status ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {h.status ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Hospital Details / Form */}
              <div className="space-y-6">
                <Surface
                  title={selectedHospital ? `Configure: ${selectedHospital.name}` : "Register New Hospital"}
                  description={selectedHospital ? "Update hospital status, reserve subdomain routing, assign features modules, and manage logins." : "Provide operational name, custom subdomain routing configuration, and initial tenant settings."}
                >
                  <form onSubmit={handleSaveHospital} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#20231f]">Hospital Name</label>
                        <input
                          type="text"
                          required
                          value={hospitalForm.name}
                          onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                          className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 bg-white"
                          placeholder="e.g. Apollo Hospital Delhi"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[#20231f]">Subdomain Prefix</label>
                        <input
                          type="text"
                          required
                          disabled={!!selectedHospital}
                          value={hospitalForm.subdomain}
                          onChange={(e) => setHospitalForm({ ...hospitalForm, subdomain: e.target.value })}
                          className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 bg-white disabled:bg-[#f3f5f0] disabled:cursor-not-allowed"
                          placeholder="e.g. apollo-delhi"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 border-t border-[#dfe4d9] pt-4 mt-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#20231f]">Logo URL</label>
                        <input
                          type="text"
                          value={hospitalForm.logo}
                          onChange={(e) => setHospitalForm({ ...hospitalForm, logo: e.target.value })}
                          className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 bg-white"
                          placeholder="https://example.com/logo.png"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[#20231f]">Login Image 1 (Lobby/Reception)</label>
                        <input
                          type="text"
                          value={hospitalForm.loginImage1}
                          onChange={(e) => setHospitalForm({ ...hospitalForm, loginImage1: e.target.value })}
                          className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 bg-white"
                          placeholder="https://example.com/lobby.jpg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[#20231f]">Login Image 2 (Consultation)</label>
                        <input
                          type="text"
                          value={hospitalForm.loginImage2}
                          onChange={(e) => setHospitalForm({ ...hospitalForm, loginImage2: e.target.value })}
                          className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 bg-white"
                          placeholder="https://example.com/consultation.jpg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-[#20231f]">Login Image 3 (Lab/Radiology)</label>
                        <input
                          type="text"
                          value={hospitalForm.loginImage3}
                          onChange={(e) => setHospitalForm({ ...hospitalForm, loginImage3: e.target.value })}
                          className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 bg-white"
                          placeholder="https://example.com/lab.jpg"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 py-2">
                      <div className="flex items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={hospitalForm.status}
                            onChange={(e) => setHospitalForm({ ...hospitalForm, status: e.target.checked })}
                            className="h-4 w-4 rounded border-[#cfd6ca]"
                          />
                          Hospital Active
                        </label>

                        {hospitalForm.subdomain && (
                          <div className="text-xs">
                            Status: <span className="font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 border border-amber-200 rounded">Reserved</span> 
                            <span className="text-[#626a62] ml-1">
                              (
                              <a
                                href={getHospitalUrl(hospitalForm.subdomain)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#2f5d50] hover:underline font-semibold"
                              >
                                {hospitalForm.subdomain}.medflow.com
                              </a>
                              )
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSavingHospital}
                        className="h-10 px-6 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60"
                      >
                        {isSavingHospital ? "Saving..." : selectedHospital ? "Update Hospital" : "Create Hospital"}
                      </button>
                    </div>

                    {hospitalMsg && (
                      <div className="rounded-md bg-[#eef8f1] p-3 text-sm text-[#27603a]">
                        {hospitalMsg}
                      </div>
                    )}
                    {hospitalErr && (
                      <div className="rounded-md bg-[#fff0ef] p-3 text-sm text-[#9f2d24]">
                        {hospitalErr}
                      </div>
                    )}
                  </form>
                </Surface>

                {selectedHospital && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Module assignment */}
                    <Surface
                      title="SaaS Module Assignment"
                      description="Toggle which product features are enabled for Apollo Hospital Delhi. Disabled modules cannot be accessed."
                    >
                      {isLoadingStats ? (
                        <div className="text-center py-4 text-[#626a62]">Loading catalog...</div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                            {moduleCatalog.map((m) => {
                              const isChecked = assignedModuleIds.includes(m.id);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => handleToggleModule(m.id)}
                                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                                    isChecked
                                      ? "bg-[#eef8f1] border-green-300 text-green-900"
                                      : "bg-white border-[#d8ddd3] text-[#626a62] hover:bg-[#f3f5f0]"
                                  }`}
                                >
                                  <span className="text-sm font-bold">{isChecked ? "✓" : "✗"}</span>
                                  <div>
                                    <p className="font-semibold text-xs text-[#20231f]">{m.name}</p>
                                    <p className="text-[10px] text-[#626a62]">{m.code}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={handleSaveModules}
                            disabled={isSavingModules}
                            className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60"
                          >
                            {isSavingModules ? "Updating Modules..." : "Assign Modules"}
                          </button>
                        </div>
                      )}
                    </Surface>

                    {/* Create initial hospital admin */}
                    <Surface
                      title="Configure Hospital Admin"
                      description="Create the primary login account credentials for this hospital tenant."
                    >
                      <form onSubmit={handleCreateHospitalAdmin} className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold">Administrator Name</label>
                          <input
                            type="text"
                            required
                            value={adminForm.fullName}
                            onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                            className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                            placeholder="e.g. Dr. Raj Sharma"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold">Username</label>
                            <input
                              type="text"
                              required
                              value={adminForm.username}
                              onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                              className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                              placeholder="e.g. apolloadmin"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold">Password</label>
                            <input
                              type="password"
                              required
                              value={adminForm.password}
                              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                              className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                              placeholder="••••••"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold">Employee Code (Optional)</label>
                          <input
                            type="text"
                            value={adminForm.employeeCode}
                            onChange={(e) => setAdminForm({ ...adminForm, employeeCode: e.target.value })}
                            className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                            placeholder="e.g. EMP001 (auto generated if blank)"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isCreatingAdmin}
                          className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60"
                        >
                          {isCreatingAdmin ? "Setting credentials..." : "Create Hospital Admin"}
                        </button>

                        {adminMsg && (
                          <div className="rounded-md bg-[#eef8f1] p-3 text-sm text-[#27603a]">
                            {adminMsg}
                          </div>
                        )}
                        {adminErr && (
                          <div className="rounded-md bg-[#fff0ef] p-3 text-sm text-[#9f2d24]">
                            {adminErr}
                          </div>
                        )}
                      </form>
                    </Surface>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Modules */}
        {activeTab === "modules" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">System Feature Catalog</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Global definitions of SaaS application modules and features.
              </p>
            </div>

            <Surface title="Feature Catalog Modules" description="Active SaaS capabilities that can be assigned to hospital subscription tiers.">
              <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {moduleCatalog.map((m) => (
                  <div key={m.id} className="p-4 bg-white border border-[#d8ddd3] rounded-lg shadow-sm">
                    <p className="font-semibold text-sm text-[#2f5d50]">{m.name}</p>
                    <p className="text-xs font-bold text-[#626a62] uppercase tracking-wider mt-1">{m.code}</p>
                    <p className="text-xs text-[#626a62] mt-2 leading-relaxed">
                      {m.description || "No description provided."}
                    </p>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* Tab: Patients */}
        {activeTab === "patients" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Global Patients Directory</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Search and view patient demographics across all hospitals registered on the platform.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                <select
                  value={patientFilterHospitalId}
                  onChange={(e) => {
                    setPatientFilterHospitalId(e.target.value);
                    setPatientPage(1);
                  }}
                  className="h-10 min-w-64 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                >
                  <option value="">All Hospitals</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Search by Aadhaar, Code, Name, Phone..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setPatientPage(1);
                  }}
                  className="h-10 w-80 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                />
              </div>

              <div className="text-xs text-[#626a62] font-semibold bg-[#eef3eb] px-3 py-1.5 rounded-md border border-[#d2edd9]">
                Total Records: {patientPagination.total}
              </div>
            </div>

            <Surface title="Central Patient Registry">
              {isLoadingPatients ? (
                <div className="text-center py-8 text-[#626a62]">Loading global patient directory...</div>
              ) : patients.length === 0 ? (
                <p className="text-center py-8 text-[#626a62]">No patients match the specified criteria.</p>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-[#f3f5f0] text-xs uppercase tracking-wider text-[#626a62]">
                        <tr>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Code</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Name</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Hospital</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Gender</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Aadhaar Card</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Contact</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Reg. Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patients.map((p) => {
                          const patientHospital = hospitals.find(h => h.id === p.hospitalId);
                          return (
                            <tr key={p.id} className="border-b border-[#edf0e9] hover:bg-[#fcfdfc] transition">
                              <td className="px-5 py-4 font-semibold text-[#2f5d50]">{p.patientCode}</td>
                              <td className="px-5 py-4 font-medium">
                                {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ")}
                              </td>
                              <td className="px-5 py-4">{patientHospital?.name || "Unknown"}</td>
                              <td className="px-5 py-4 capitalize text-xs">{p.gender.toLowerCase()}</td>
                              <td className="px-5 py-4 font-mono text-xs">{p.aadhaarNumber || "N/A"}</td>
                              <td className="px-5 py-4">
                                <div className="text-xs text-[#20231f]">{p.phone || "N/A"}</div>
                                <div className="text-[10px] text-[#626a62]">{p.email || ""}</div>
                              </td>
                              <td className="px-5 py-4 text-xs text-[#626a62]">
                                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "N/A"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between pt-4 border-t border-[#dfe4d9]">
                    <div className="text-xs text-[#626a62]">
                      Showing Page <span className="font-semibold text-[#20231f]">{patientPagination.page}</span> of{" "}
                      <span className="font-semibold text-[#20231f]">{patientPagination.totalPages}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPatientPage(p => Math.max(p - 1, 1))}
                        disabled={patientPage <= 1}
                        className="h-8 px-3 text-xs font-semibold border border-[#cfd6ca] rounded hover:bg-[#f3f5f0] disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPatientPage(p => Math.min(p + 1, patientPagination.totalPages))}
                        disabled={patientPage >= patientPagination.totalPages}
                        className="h-8 px-3 text-xs font-semibold border border-[#cfd6ca] rounded hover:bg-[#f3f5f0] disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Surface>
          </div>
        )}

        {/* Tab 4: Users */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Global Platform Users Directory</h2>
              <p className="text-sm text-[#626a62] mt-1">
                View, audit, and toggle login permissions for all hospital staff and users.
              </p>
            </div>

            <div className="flex gap-4 items-center">
              <select
                onChange={(e) => {
                  if (token) fetchAllUsers(token, e.target.value);
                }}
                className="h-10 min-w-64 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm outline-none"
              >
                <option value="">Select hospital filter</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Filter users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-10 w-64 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm outline-none"
              />
            </div>

            <Surface title="Hospital Users Directory">
              {isLoadingAllUsers ? (
                <div className="text-center py-8 text-[#626a62]">Loading user directory...</div>
              ) : allUsers.length === 0 ? (
                <p className="text-center py-8 text-[#626a62]">Select a hospital filter to list user profiles.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-[#f3f5f0] text-xs uppercase tracking-wider text-[#626a62]">
                      <tr>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Username</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Hospital</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Employee Code</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Full Name</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Designation</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Status</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers
                        .filter((u) => {
                          const q = userSearch.toLowerCase().trim();
                          return (
                            u.username.toLowerCase().includes(q) ||
                            (u.employee?.fullName || "").toLowerCase().includes(q)
                          );
                        })
                        .map((u) => (
                          <tr key={u.id} className="border-b border-[#edf0e9] hover:bg-[#fcfdfc] transition">
                            <td className="px-5 py-4 font-semibold text-[#2f5d50]">{u.username}</td>
                            <td className="px-5 py-4 font-medium">{u.hospital?.name ?? "SaaS Owner"}</td>
                            <td className="px-5 py-4">{u.employee?.employeeCode ?? "N/A"}</td>
                            <td className="px-5 py-4">{u.employee?.fullName ?? "No Employee Profile"}</td>
                            <td className="px-5 py-4">{u.employee?.designation ?? "N/A"}</td>
                            <td className="px-5 py-4">
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${u.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                {u.isActive ? "Active" : "Disabled"}
                              </span>
                            </td>
                            <td className="px-5 py-4 flex gap-2">
                              <button
                                onClick={() => handleToggleUserActive(u)}
                                className={`text-xs px-3 py-1 border rounded-md font-semibold transition ${
                                  u.isActive
                                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                    : "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                                }`}
                              >
                                {u.isActive ? "Disable" : "Enable"}
                              </button>
                              <button
                                onClick={() => handleResetUserPassword(u.id, u.username)}
                                className="text-xs px-3 py-1 border border-amber-200 bg-amber-50 text-amber-700 rounded-md font-semibold hover:bg-amber-100 transition"
                              >
                                Reset Pass
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Surface>
          </div>
        )}

        {/* Tab 5: Settings */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">SaaS Platform Settings</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Configure SaaS endpoints, global variables, and administrator profile.
              </p>
            </div>

            <Surface title="Platform Global Configuration">
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold">SaaS Platform Domain Name</label>
                    <input
                      type="text"
                      disabled
                      value="medflow-saas.com"
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-[#f3f5f0] cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold">Reserved Tenant Pathing</label>
                    <input
                      type="text"
                      disabled
                      value="*.medflow-saas.com"
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-[#f3f5f0] cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 leading-relaxed">
                  <strong>ℹ️ Subdomain Routing Notice:</strong> Actual domain level routing integration is not enabled yet. Tenant workspaces are securely sandboxed inside the database utilizing unique hospital and tenant identifiers. Wildcard subdomains configuration (*.medflow-saas.com) will be deployed in a future release.
                </div>
              </div>
            </Surface>

            <Surface title="Account Security" description="Update your Super Admin account password.">
              <form onSubmit={handleChangeOwnPassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-semibold">New Password</label>
                  <input
                    type="password"
                    required
                    value={ownPassword}
                    onChange={(e) => setOwnPassword(e.target.value)}
                    className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={ownPasswordConfirm}
                    onChange={(e) => setOwnPasswordConfirm(e.target.value)}
                    className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2"
                    placeholder="Retype password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingOwnPassword}
                  className="h-10 px-6 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60"
                >
                  {isSavingOwnPassword ? "Updating..." : "Update Password"}
                </button>

                {ownPasswordMsg && (
                  <div className="rounded bg-[#eef8f1] p-3 text-xs text-[#27603a] font-semibold">
                    {ownPasswordMsg}
                  </div>
                )}
                {ownPasswordErr && (
                  <div className="rounded bg-[#fff0ef] p-3 text-xs text-[#9f2d24] font-semibold">
                    {ownPasswordErr}
                  </div>
                )}
              </form>
            </Surface>
          </div>
        )}
      </section>
    </main>
  );
}
