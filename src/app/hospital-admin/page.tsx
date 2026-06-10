"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Surface } from "@/components/ui/surface";

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

type Patient = {
  id: string;
  patientCode: string;
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  gender: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  aadhaarNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  allergies?: string | null;
  remarks?: string | null;
  isActive: boolean;
};

type UserAccount = {
  id: string;
  username: string;
  isActive: boolean;
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    phone?: string | null;
    designation: string;
    department?: string | null;
  } | null;
  roles: Array<{ role: { id: string; name: string } }>;
};

type Role = {
  id: string;
  name: string;
  permissions: Array<{ permission: { id: string; code: string } }>;
};

type Permission = {
  id: string;
  code: string;
  description?: string | null;
};

type Stats = {
  todayAppointments: number;
  totalPatients: number;
  doctorCount: number;
  totalEmployees: number;
  revenueToday: number;
  pendingBillsCount: number;
};

export default function HospitalAdminPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<any>(null);
  const [hospitalId, setHospitalId] = useState("");
  const [hospitalName, setHospitalName] = useState("");

  // Nav state
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, patients, appointments, employees, user-accounts, roles, reports, settings

  // Modules visibility
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  
  // Stats state
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Employee management state
  const [employees, setEmployees] = useState<UserAccount[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    employeeCode: "",
    designation: "",
    department: "",
    phone: "",
  });
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [employeeMsg, setEmployeeMsg] = useState("");
  const [employeeErr, setEmployeeErr] = useState("");

  // User accounts linker state
  const [loginForm, setLoginForm] = useState({
    employeeId: "", // actual user ID mapping to the employee
    username: "",
    password: "",
    roleId: "",
  });
  const [isSavingLogin, setIsSavingLogin] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");
  const [loginErr, setLoginErr] = useState("");

  // Role & Permissions state
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleForm, setRoleForm] = useState({ name: "" });
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleMsg, setRoleMsg] = useState("");
  const [roleErr, setRoleErr] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [assignedPermissionIds, setAssignedPermissionIds] = useState<string[]>([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Patients & Appointments list state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoadingClinical, setIsLoadingClinical] = useState(false);

  // Hospital settings state
  const [hospitalForm, setHospitalForm] = useState({ name: "", subdomain: "", logo: "", loginImage1: "", loginImage2: "", loginImage3: "" });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  // Hospital Admin Password Change States
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

  const handleResetEmployeePassword = async (employeeUserId: string, employeeName: string) => {
    if (!token) return;
    const confirmReset = window.confirm(`Are you sure you want to reset the password for "${employeeName}" to the default "ChangeMe@123"?`);
    if (!confirmReset) return;

    try {
      const res = await fetch(`/api/users/${employeeUserId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: "ChangeMe@123" }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Password for "${employeeName}" has been successfully reset to "ChangeMe@123".`);
      } else {
        alert(`Failed to reset password: ${data.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to reset password due to connection error.");
    }
  };

  // Reports state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

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
      setToken(savedToken);
      setUser(parsedUser);
      setHospitalId(parsedUser.hospitalId || "");
    } catch {
      router.push("/login");
    }
  }, [router]);

  // Load Hospital Information & Modules
  useEffect(() => {
    if (!token || !hospitalId) return;

    // Fetch hospital name
    fetch(`/api/hospitals/${hospitalId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setHospitalName(data.data.name);
          setHospitalForm({
            name: data.data.name,
            subdomain: data.data.subdomain,
            logo: data.data.logo || "",
            loginImage1: data.data.loginImage1 || "",
            loginImage2: data.data.loginImage2 || "",
            loginImage3: data.data.loginImage3 || "",
          });
        }
      });

    // Fetch enabled modules
    fetch(`/api/hospitals/${hospitalId}/modules`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEnabledModules(
            data.data.filter((item: any) => item.enabled).map((item: any) => item.module.code)
          );
        }
      });
  }, [token, hospitalId]);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    if (!token || !hospitalId) return;
    setIsLoadingStats(true);
    try {
      const res = await fetch(`/api/hospitals/${hospitalId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [token, hospitalId]);

  // Fetch Employees List
  const fetchEmployees = useCallback(async () => {
    if (!token || !hospitalId) return;
    setIsLoadingEmployees(true);
    try {
      // In this setup, we list users which include employee profiles
      const res = await fetch(`/api/users?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingEmployees(false);
    }
  }, [token, hospitalId]);

  // Fetch Roles and Permissions
  const fetchRolesAndPermissions = useCallback(async () => {
    if (!token || !hospitalId) return;
    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        fetch(`/api/roles?hospitalId=${hospitalId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const rolesData = await rolesRes.json();
      const permissionsData = await permissionsRes.json();

      if (rolesData.success) setRoles(rolesData.data.roles);
      if (permissionsData.success) setPermissions(permissionsData.data);
    } catch (err) {
      console.error(err);
    }
  }, [token, hospitalId]);

  // Fetch Clinical Info (Appointments only)
  const fetchClinicalInfo = useCallback(async () => {
    if (!token || !hospitalId) return;
    setIsClinicalLoading(true);
    try {
      const res = await fetch(`/api/appointments?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAppointments(data.data.appointments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClinicalLoading(false);
    }
  }, [token, hospitalId]);

  const [isClinicalLoading, setIsClinicalLoading] = useState(false);

  // Paginated patients state for Hospital Admin
  const [patientSearch, setPatientSearch] = useState("");
  const [patientPage, setPatientPage] = useState(1);
  const [patientPagination, setPatientPagination] = useState<any>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  const fetchPatientsPaginated = useCallback(async (searchVal = "", pageNum = 1) => {
    if (!token || !hospitalId) return;
    setIsLoadingPatients(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: "10",
        search: searchVal,
        hospitalId,
      });
      const res = await fetch(`/api/patients?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  }, [token, hospitalId]);

  // Sync effect to load patients when tab/filters change
  useEffect(() => {
    if (token && hospitalId && activeTab === "patients") {
      fetchPatientsPaginated(patientSearch, patientPage);
    }
  }, [token, hospitalId, activeTab, patientSearch, patientPage, fetchPatientsPaginated]);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    if (!token || !hospitalId) return;
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/activity-logs?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setActivityLogs(data.data.logs || data.data.activityLogs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [token, hospitalId]);

  // Load screen data based on Tab
  useEffect(() => {
    if (token && hospitalId) {
      if (activeTab === "dashboard") fetchStats();
      if (activeTab === "employees") fetchEmployees();
      if (activeTab === "user-accounts") {
        fetchEmployees();
        fetchRolesAndPermissions();
      }
      if (activeTab === "roles") fetchRolesAndPermissions();
      if (activeTab === "patients" || activeTab === "appointments") fetchClinicalInfo();
      if (activeTab === "reports") fetchLogs();
    }
  }, [activeTab, token, hospitalId, fetchStats, fetchEmployees, fetchRolesAndPermissions, fetchClinicalInfo, fetchLogs]);

  // Handle Tab Switch
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setEmployeeMsg("");
    setEmployeeErr("");
    setLoginMsg("");
    setLoginErr("");
    setRoleMsg("");
    setRoleErr("");
    setSettingsMsg("");
  };

  // Create Employee
  const handleCreateEmployee = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !hospitalId) return;

    setIsSavingEmployee(true);
    setEmployeeMsg("");
    setEmployeeErr("");

    const code = employeeForm.employeeCode.trim() || `EMP-${Date.now().toString().slice(-6)}`;
    const tempUsername = `pending_emp_${code.toLowerCase().replace("-", "_")}`;
    const tempPassword = `tempPass${Date.now().toString().slice(-4)}`;

    try {
      // Create user & employee profile
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hospitalId,
          username: tempUsername,
          password: tempPassword,
          employeeCode: code,
          fullName: employeeForm.fullName.trim(),
          designation: employeeForm.designation.trim(),
          department: employeeForm.department.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setEmployeeErr(data.message);
        setIsSavingEmployee(false);
        return;
      }

      // Immediately disable the login account so it's a separate step to configure login credentials
      const userId = data.data.user.id;
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: false }),
      });

      setEmployeeMsg(`Employee record created successfully! System Code: ${code}`);
      setEmployeeForm({ fullName: "", employeeCode: "", designation: "", department: "", phone: "" });
      await fetchEmployees();
    } catch (err) {
      console.error(err);
      setEmployeeErr("Connection error. Please try again.");
    } finally {
      setIsSavingEmployee(false);
    }
  };

  // Update an existing user's role assignment
  const handleUpdateUserRole = async (userId: string, roleId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/users/${userId}/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roleId }),
      });
      const data = await res.json();
      if (data.success) {
        setLoginMsg("Employee role updated successfully!");
        await fetchEmployees();
      } else {
        setLoginErr(data.message);
      }
    } catch (err) {
      console.error(err);
      setLoginErr("Failed to update employee role.");
    }
  };

  // Toggle user active/inactive login state
  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setLoginMsg(`User account ${!currentStatus ? "activated" : "deactivated"} successfully!`);
        await fetchEmployees();
      } else {
        setLoginErr(data.message);
      }
    } catch (err) {
      console.error(err);
      setLoginErr("Failed to toggle user status.");
    }
  };

  // Create Login Credentials (update credentials and enable account)
  const handleCreateLoginAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !loginForm.employeeId) {
      setLoginErr("Select an employee first");
      return;
    }

    setIsSavingLogin(true);
    setLoginMsg("");
    setLoginErr("");

    try {
      // 1. Update Username and Password and set active to true
      const updateRes = await fetch(`/api/users/${loginForm.employeeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password.trim(),
          isActive: true,
        }),
      });

      const updateData = await updateRes.json();
      if (!updateData.success) {
        setLoginErr(updateData.message);
        setIsSavingLogin(false);
        return;
      }

      // 2. Assign Role if selected
      if (loginForm.roleId) {
        await fetch(`/api/users/${loginForm.employeeId}/roles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roleId: loginForm.roleId }),
        });
      }

      setLoginMsg("Login account activated successfully!");
      setLoginForm({ employeeId: "", username: "", password: "", roleId: "" });
      await fetchEmployees();
    } catch (err) {
      console.error(err);
      setLoginErr("Failed to assign login account credentials.");
    } finally {
      setIsSavingLogin(false);
    }
  };

  // Create Custom Role
  const handleCreateRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !hospitalId) return;

    setIsSavingRole(true);
    setRoleMsg("");
    setRoleErr("");

    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hospitalId,
          name: roleForm.name.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setRoleErr(data.message);
      } else {
        setRoleMsg("Role created successfully!");
        setRoleForm({ name: "" });
        await fetchRolesAndPermissions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingRole(false);
    }
  };

  // Open Role permissions assignment
  const handleOpenRolePermissions = (role: Role) => {
    setSelectedRoleId(role.id);
    setAssignedPermissionIds(role.permissions.map((p) => p.permission.id));
  };

  // Toggle permission list
  const handleTogglePermission = (pId: string) => {
    setAssignedPermissionIds((curr) =>
      curr.includes(pId) ? curr.filter((id) => id !== pId) : [...curr, pId]
    );
  };

  // Save Permissions
  const handleSavePermissions = async () => {
    if (!selectedRoleId || !token) return;
    setIsSavingPermissions(true);
    setRoleMsg("");
    setRoleErr("");

    try {
      const res = await fetch(`/api/roles/${selectedRoleId}/permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissionIds: assignedPermissionIds }),
      });
      const data = await res.json();
      if (data.success) {
        setRoleMsg("Permissions updated successfully!");
        await fetchRolesAndPermissions();
      } else {
        setRoleErr(data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Update settings
  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !hospitalId) return;

    setIsSavingSettings(true);
    setSettingsMsg("");

    try {
      const res = await fetch(`/api/hospitals/${hospitalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: hospitalForm.name.trim(),
          logo: hospitalForm.logo ? hospitalForm.logo.trim() : null,
          loginImage1: hospitalForm.loginImage1 ? hospitalForm.loginImage1.trim() : null,
          loginImage2: hospitalForm.loginImage2 ? hospitalForm.loginImage2.trim() : null,
          loginImage3: hospitalForm.loginImage3 ? hospitalForm.loginImage3.trim() : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsMsg("Hospital settings saved!");
        setHospitalName(data.data.name);
        setHospitalForm({
          name: data.data.name,
          subdomain: data.data.subdomain,
          logo: data.data.logo || "",
          loginImage1: data.data.loginImage1 || "",
          loginImage2: data.data.loginImage2 || "",
          loginImage3: data.data.loginImage3 || "",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("hospital_token");
    localStorage.removeItem("hospital_user");
    router.push("/login");
  };

  // Filter employees showing pending login mapping
  const pendingEmployees = employees.filter((emp) => emp.username.startsWith("pending_emp_"));

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#20231f] flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#dfe4d9] bg-white flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-[#dfe4d9]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#477063]">
              Operations Portal
            </p>
            <h1 className="text-xl font-bold mt-1 text-[#151917] truncate">{hospitalName || "Hospital Admin"}</h1>
          </div>

          <nav className="p-4 space-y-1">
            {[
              { id: "dashboard", label: "Dashboard", enabled: true },
              { id: "patients", label: "Patients Directory", enabled: true },
              { id: "appointments", label: "Appointments", enabled: enabledModules.includes("APPOINTMENTS") },
              { id: "employees", label: "Employees Directory", enabled: true },
              { id: "user-accounts", label: "User Login Accounts", enabled: true },
              { id: "roles", label: "Roles & Permissions", enabled: true },
              { id: "reports", label: "Operational Logs", enabled: true },
              { id: "settings", label: "Settings", enabled: true },
            ].map((tab) => {
              if (!tab.enabled) return null;
              return (
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
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[#dfe4d9] flex flex-col gap-2">
          <div className="text-xs text-[#626a62] px-4">
            Logged in as <span className="font-semibold text-[#20231f]">{user?.username}</span>
            <div className="text-[10px] mt-0.5 uppercase tracking-wider text-[#477063] font-bold">Hospital Owner</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm font-semibold text-red-600 rounded-md hover:bg-red-50 transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Content area */}
      <section className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Tab 1: Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Operational Dashboard</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Real-time operational summary of your hospital facilities.
              </p>
            </div>

            {isLoadingStats ? (
              <div className="text-center py-12 text-[#626a62]">Loading stats...</div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: "Today's Appointments", val: stats?.todayAppointments ?? 0 },
                  { label: "Total Patients Registered", val: stats?.totalPatients ?? 0 },
                  { label: "Active Doctors", val: stats?.doctorCount ?? 0 },
                  { label: "Total Staff Directory", val: stats?.totalEmployees ?? 0 },
                  { label: "Revenue Collected Today", val: `$${stats?.revenueToday ?? 0}` },
                  { label: "Pending Bills Queue", val: stats?.pendingBillsCount ?? 0 },
                ].map((card, i) => (
                  <div
                    key={i}
                    className="p-5 rounded-lg border border-[#d8ddd3] bg-white shadow-sm flex flex-col justify-between h-24"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#626a62]">
                      {card.label}
                    </p>
                    <p className="text-2xl font-bold tracking-tight text-[#2f5d50]">{card.val}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Patients */}
        {activeTab === "patients" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Patients Registry</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Hospital database records of registered patients.
              </p>
            </div>

            <div className="flex gap-4 items-center justify-between">
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
              <div className="text-xs text-[#626a62] font-semibold bg-[#eef3eb] px-3 py-1.5 rounded-md border border-[#d2edd9] ml-auto">
                Total Patients: {patientPagination.total}
              </div>
            </div>

            <Surface title="Hospital Patients Database">
              {isLoadingPatients ? (
                <div className="text-center py-8 text-[#626a62]">Loading directory...</div>
              ) : patients.length === 0 ? (
                <p className="text-center py-8 text-[#626a62]">No patients registered in the hospital database.</p>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-[#f3f5f0] text-xs uppercase tracking-wider text-[#626a62]">
                        <tr>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Code</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Name</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Gender</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Aadhaar</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Contact</th>
                          <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patients.map((p: any) => (
                          <tr key={p.id} className="border-b border-[#edf0e9] hover:bg-[#fcfdfc] transition">
                            <td className="px-5 py-4 font-semibold text-[#2f5d50]">{p.patientCode}</td>
                            <td className="px-5 py-4 font-medium">{[p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ")}</td>
                            <td className="px-5 py-4 capitalize text-xs">{p.gender.toLowerCase()}</td>
                            <td className="px-5 py-4 font-mono text-xs">{p.aadhaarNumber || "N/A"}</td>
                            <td className="px-5 py-4">
                              <div className="text-xs text-[#20231f]">{p.phone || "N/A"}</div>
                              <div className="text-[10px] text-[#626a62]">{p.email || ""}</div>
                            </td>
                            <td className="px-5 py-4">{[p.city, p.state].filter(Boolean).join(", ") || "N/A"}</td>
                          </tr>
                        ))}
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

        {/* Tab 3: Appointments */}
        {activeTab === "appointments" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Appointments Queue</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Hospital appointment logs and scheduling tracking.
              </p>
            </div>

            <Surface title="Appointments List">
              {isClinicalLoading ? (
                <div className="text-center py-8 text-[#626a62]">Loading queue...</div>
              ) : appointments.length === 0 ? (
                <p className="text-center py-8 text-[#626a62]">No appointments scheduled.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-[#f3f5f0] text-xs uppercase tracking-wider text-[#626a62]">
                      <tr>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">No</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Patient</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Doctor</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Date</th>
                        <th className="px-5 py-3 font-semibold border-b border-[#dfe4d9]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((a) => (
                        <tr key={a.id} className="border-b border-[#edf0e9]">
                          <td className="px-5 py-4 font-semibold text-[#2f5d50]">{a.appointmentNo}</td>
                          <td className="px-5 py-4 font-medium">{[a.patient?.firstName, a.patient?.lastName].filter(Boolean).join(" ")}</td>
                          <td className="px-5 py-4">{a.doctor?.fullName || "Unassigned"}</td>
                          <td className="px-5 py-4">{new Date(a.appointmentAt).toLocaleDateString()}</td>
                          <td className="px-5 py-4">
                            <span className="text-xs px-2 py-0.5 rounded bg-[#eef3eb] text-[#4b5f43] font-semibold">
                              {a.status}
                            </span>
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

        {/* Tab 4: Employees */}
        {activeTab === "employees" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Staff & Employees Management</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Add clinicians, receptionists, and technicans. Credentials and logins setup are handled separately.
              </p>
            </div>

            <div className="grid lg:grid-cols-[400px_1fr] gap-6">
              {/* Form */}
              <Surface title="Create Employee Profile">
                <form onSubmit={handleCreateEmployee} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold">Full Name</label>
                    <input
                      type="text"
                      required
                      value={employeeForm.fullName}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                      placeholder="e.g. Dr. Raj Sharma"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold">Designation</label>
                      <input
                        type="text"
                        required
                        value={employeeForm.designation}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                        className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                        placeholder="e.g. Doctor, Receptionist"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold">Department</label>
                      <input
                        type="text"
                        required
                        value={employeeForm.department}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                        className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                        placeholder="e.g. Cardiology, Desk"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">Employee Code (Optional)</label>
                    <input
                      type="text"
                      value={employeeForm.employeeCode}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, employeeCode: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                      placeholder="e.g. EMP001 (auto generated)"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingEmployee}
                    className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60"
                  >
                    {isSavingEmployee ? "Saving..." : "Save Employee Record"}
                  </button>

                  {employeeMsg && (
                    <div className="rounded-md bg-[#eef8f1] p-3 text-sm text-[#27603a]">
                      {employeeMsg}
                    </div>
                  )}
                  {employeeErr && (
                    <div className="rounded-md bg-[#fff0ef] p-3 text-sm text-[#9f2d24]">
                      {employeeErr}
                    </div>
                  )}
                </form>
              </Surface>

              {/* List */}
              <Surface title="Hospital Staff Directory">
                {isLoadingEmployees ? (
                  <div className="text-center py-8 text-[#626a62]">Loading employees list...</div>
                ) : employees.length === 0 ? (
                  <p className="text-center py-8 text-[#626a62]">No staff registered.</p>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {employees.map((emp) => {
                      const hasActiveLogin = !emp.username.startsWith("pending_emp_") && emp.isActive;
                      return (
                        <div key={emp.id} className="p-4 border border-[#d8ddd3] bg-[#fbfcfa] rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{emp.employee?.fullName || emp.username}</p>
                            <p className="text-xs text-[#626a62] mt-0.5">
                              Code: {emp.employee?.employeeCode} / Designation: {emp.employee?.designation} / Dept: {emp.employee?.department || "N/A"}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                              hasActiveLogin
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}>
                              {hasActiveLogin ? "Login Active" : "No Login Credentials"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Surface>
            </div>
          </div>
        )}

        {/* Tab 5: User Accounts setup */}
        {activeTab === "user-accounts" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">User Accounts & Logins setup</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Separate credentials setup for registered employees. Link login credentials to staff records.
              </p>
            </div>

            <div className="grid lg:grid-cols-[450px_1fr] gap-6">
              <Surface title="Setup Login Account">
                <form onSubmit={handleCreateLoginAccount} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold">Select Employee</label>
                    <select
                      required
                      value={loginForm.employeeId}
                      onChange={(e) => setLoginForm({ ...loginForm, employeeId: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                    >
                      <option value="">Select an employee...</option>
                      {pendingEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.employee?.fullName} ({emp.employee?.employeeCode}) - {emp.employee?.designation}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold">Username</label>
                      <input
                        type="text"
                        required
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                        className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                        placeholder="e.g. drraj"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold">Password</label>
                      <input
                        type="password"
                        required
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                        placeholder="••••••"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">Assign System Role</label>
                    <select
                      value={loginForm.roleId}
                      onChange={(e) => setLoginForm({ ...loginForm, roleId: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                    >
                      <option value="">Select role...</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingLogin}
                    className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60"
                  >
                    {isSavingLogin ? "Saving..." : "Configure Credentials & Enable Login"}
                  </button>

                  {loginMsg && (
                    <div className="rounded-md bg-[#eef8f1] p-3 text-sm text-[#27603a]">
                      {loginMsg}
                    </div>
                  )}
                  {loginErr && (
                    <div className="rounded-md bg-[#fff0ef] p-3 text-sm text-[#9f2d24]">
                      {loginErr}
                    </div>
                  )}
                </form>
              </Surface>

              <Surface title="Manage Active Login Accounts" description="Update roles or deactivate login credentials for existing staff members.">
                {employees.filter((emp) => !emp.username.startsWith("pending_emp_")).length === 0 ? (
                  <p className="text-center py-8 text-xs text-[#626a62]">No active employee accounts configured yet.</p>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {employees
                      .filter((emp) => !emp.username.startsWith("pending_emp_"))
                      .map((emp) => {
                        const currentRoleId = emp.roles[0]?.role?.id || "";
                        return (
                          <div key={emp.id} className="p-4 border border-[#d8ddd3] bg-[#fbfcfa] rounded-lg space-y-3 text-left">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-sm">{emp.employee?.fullName || emp.username}</p>
                                <p className="text-xs text-[#626a62] mt-0.5">
                                  Username: <span className="font-semibold text-[#20231f]">{emp.username}</span> / Designation: {emp.employee?.designation || "N/A"}
                                </p>
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                emp.isActive
                                  ? "bg-green-100 text-green-800 border border-green-200"
                                  : "bg-red-100 text-red-800 border border-red-200"
                              }`}>
                                {emp.isActive ? "Active" : "Disabled"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4 pt-2 border-t border-[#dfe4d9]">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[#626a62] font-medium">Role:</span>
                                <select
                                  value={currentRoleId}
                                  onChange={(e) => handleUpdateUserRole(emp.id, e.target.value)}
                                  className="text-xs h-8 px-2 border border-[#cfd6ca] rounded-md bg-white outline-none focus:border-[#477063] focus:ring-1 focus:ring-[#477063]/20 transition"
                                >
                                  <option value="">Select Role...</option>
                                  {roles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleResetEmployeePassword(emp.id, emp.employee?.fullName || emp.username)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                                >
                                  Reset Pass
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserStatus(emp.id, emp.isActive)}
                                  className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                                    emp.isActive
                                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                                      : "bg-green-50 text-green-600 hover:bg-green-100"
                                  }`}
                                >
                                  {emp.isActive ? "Deactivate" : "Activate"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Surface>
            </div>
          </div>
        )}

        {/* Tab 6: Roles & Permissions */}
        {activeTab === "roles" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Role Directory & Permissions Matrix</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Define functional job roles and map them to system granular permissions.
              </p>
            </div>

            <div className="grid xl:grid-cols-[400px_1fr] gap-6">
              {/* Left Column: Create Role / Directory */}
              <div className="space-y-6">
                <Surface title="Create Role">
                  <form onSubmit={handleCreateRole} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold">Role Name</label>
                      <input
                        type="text"
                        required
                        value={roleForm.name}
                        onChange={(e) => setRoleForm({ name: e.target.value })}
                        className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                        placeholder="e.g. Accountant, Receptionist"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingRole}
                      className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60"
                    >
                      {isSavingRole ? "Saving..." : "Save Role"}
                    </button>
                  </form>
                </Surface>

                <Surface title="System Roles Directory">
                  {roles.length === 0 ? (
                    <p className="text-sm text-[#626a62]">No roles configured.</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {roles.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => handleOpenRolePermissions(r)}
                          className={`w-full text-left p-4 rounded-lg border transition ${
                            selectedRoleId === r.id
                              ? "bg-[#eef3eb] border-[#477063] text-[#2f5d50]"
                              : "bg-white border-[#d8ddd3] hover:bg-[#f3f5f0]"
                          }`}
                        >
                          <p className="font-semibold text-sm">{r.name}</p>
                          <p className="text-[10px] text-[#626a62] mt-1">
                            {r.permissions.length} Permissions Mapping
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </Surface>
              </div>

              {/* Right Column: Permission Matrix */}
              <div>
                <Surface
                  title="Permissions Matrix Mapping"
                  description="Select the selected Role in the directory to assign modular capability authorizations."
                >
                  {selectedRoleId ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-2">
                        {permissions.map((p) => {
                          const isChecked = assignedPermissionIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleTogglePermission(p.id)}
                              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                                isChecked
                                  ? "bg-[#eef8f1] border-green-300 text-green-950"
                                  : "bg-white border-[#d8ddd3] text-[#626a62] hover:bg-[#f3f5f0]"
                              }`}
                            >
                              <span className="text-xs font-bold">{isChecked ? "✓" : "✗"}</span>
                              <div>
                                <p className="font-semibold text-xs text-[#20231f]">{p.code}</p>
                                <p className="text-[10px] text-[#626a62] mt-0.5 truncate">{p.description || "System permission"}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={handleSavePermissions}
                        disabled={isSavingPermissions}
                        className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60"
                      >
                        {isSavingPermissions ? "Saving Matrix..." : "Assign Permissions Matrix"}
                      </button>

                      {roleMsg && (
                        <div className="rounded-md bg-[#eef8f1] p-3 text-sm text-[#27603a]">
                          {roleMsg}
                        </div>
                      )}
                      {roleErr && (
                        <div className="rounded-md bg-[#fff0ef] p-3 text-sm text-[#9f2d24]">
                          {roleErr}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center py-12 text-[#626a62]">Select a Role from the Directory to configure mapping.</p>
                  )}
                </Surface>
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Reports/Logs */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Operational Log & Audit Trail</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Audited logs tracking employee actions and auth activities.
              </p>
            </div>

            <Surface title="Hospital Activity logs">
              {isLoadingLogs ? (
                <div className="text-center py-8 text-[#626a62]">Loading audit trail...</div>
              ) : activityLogs.length === 0 ? (
                <p className="text-center py-8 text-[#626a62]">No operational activity recorded.</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="p-3 border border-[#d8ddd3] bg-white rounded-md flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-sm">{log.title}</p>
                        <p className="text-[#626a62] mt-0.5">Details: {log.details} / Category: {log.category}</p>
                      </div>
                      <span className="text-[#626a62]">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        )}

        {/* Tab 8: Settings */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Hospital Profile Settings</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Manage your hospital metadata and subdomain mapping settings.
              </p>
            </div>

            <Surface title="Hospital Settings Configuration">
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold">Hospital Name</label>
                    <input
                      type="text"
                      required
                      value={hospitalForm.name}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold">Subdomain Prefix (Reserved)</label>
                    <div className="flex flex-col mt-2">
                      <input
                        type="text"
                        disabled
                        value={hospitalForm.subdomain}
                        className="block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-[#f3f5f0] cursor-not-allowed"
                      />
                      {hospitalForm.subdomain && (
                        <span className="text-xs mt-1 text-[#626a62]">
                          Link:{" "}
                          <a
                            href={getHospitalUrl(hospitalForm.subdomain)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#2f5d50] hover:underline font-semibold"
                          >
                            {hospitalForm.subdomain}.medflow.com
                          </a>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 border-t border-[#dfe4d9] pt-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold">Logo URL</label>
                    <input
                      type="text"
                      value={hospitalForm.logo}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, logo: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">Login Image 1 (Lobby/Reception)</label>
                    <input
                      type="text"
                      value={hospitalForm.loginImage1}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, loginImage1: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
                      placeholder="https://example.com/lobby.jpg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">Login Image 2 (Consultation)</label>
                    <input
                      type="text"
                      value={hospitalForm.loginImage2}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, loginImage2: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
                      placeholder="https://example.com/consultation.jpg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">Login Image 3 (Lab/Radiology)</label>
                    <input
                      type="text"
                      value={hospitalForm.loginImage3}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, loginImage3: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
                      placeholder="https://example.com/lab.jpg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="h-10 px-6 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60"
                >
                  {isSavingSettings ? "Saving Settings..." : "Save Configuration"}
                </button>

                {settingsMsg && (
                  <div className="rounded-md bg-[#eef8f1] p-3 text-sm text-[#27603a]">
                    {settingsMsg}
                  </div>
                )}
              </form>
            </Surface>

            <Surface title="Account Security" description="Update your own login password.">
              <form onSubmit={handleChangeOwnPassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-semibold">New Password</label>
                  <input
                    type="password"
                    required
                    value={ownPassword}
                    onChange={(e) => setOwnPassword(e.target.value)}
                    className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
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
                    className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
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
                  <div className="rounded-md bg-[#eef8f1] p-3 text-sm text-[#27603a] font-semibold">
                    {ownPasswordMsg}
                  </div>
                )}
                {ownPasswordErr && (
                  <div className="rounded-md bg-[#fff0ef] p-3 text-sm text-[#9f2d24] font-semibold">
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
