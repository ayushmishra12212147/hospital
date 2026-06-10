"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Surface } from "@/components/ui/surface";

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; message: string };

type Hospital = {
  id: string;
  name: string;
  subdomain: string;
  status: boolean;
};

type Permission = {
  id: string;
  code: string;
  description?: string | null;
};

type RolePermission = {
  permissionId: string;
  permission: Permission;
};

type Role = {
  id: string;
  name: string;
  hospitalId: string;
  permissions: RolePermission[];
  users?: Array<{
    user: {
      id: string;
      username: string;
      employee?: {
        fullName: string;
      } | null;
    };
  }>;
};

type UserRole = {
  roleId: string;
  role: Role;
};

type User = {
  id: string;
  username: string;
  isActive: boolean;
  employee?: {
    employeeCode: string;
    fullName: string;
    designation: string;
    department?: string | null;
  } | null;
  roles: UserRole[];
};

type HospitalAdminConsoleProps = {
  token: string;
  hospitalId: string;
};

type HospitalForm = {
  name: string;
  subdomain: string;
};

type UserForm = {
  username: string;
  password: string;
  employeeCode: string;
  fullName: string;
  designation: string;
  department: string;
};

type RoleForm = {
  name: string;
};

const initialHospitalForm: HospitalForm = {
  name: "",
  subdomain: "",
};

const initialUserForm: UserForm = {
  username: "",
  password: "",
  employeeCode: "",
  fullName: "",
  designation: "",
  department: "",
};

const initialRoleForm: RoleForm = {
  name: "",
};

function formatEnum(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "Not set";
}

export function HospitalAdminConsole({
  token,
  hospitalId,
}: HospitalAdminConsoleProps) {
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [hospitalForm, setHospitalForm] = useState<HospitalForm>(initialHospitalForm);
  const [userForm, setUserForm] = useState<UserForm>(initialUserForm);
  const [roleForm, setRoleForm] = useState<RoleForm>(initialRoleForm);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [assignedPermissionIds, setAssignedPermissionIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingHospital, setIsSavingHospital] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [isSavingUserRole, setIsSavingUserRole] = useState<string>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) =>
      [
        user.username,
        user.employee?.employeeCode,
        user.employee?.fullName,
        user.employee?.designation,
        user.employee?.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [userSearch, users]);

  const filteredRoles = useMemo(() => {
    const query = roleSearch.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((role) => role.name.toLowerCase().includes(query));
  }, [roleSearch, roles]);

  function syncSelectedRole(roleId: string, roleList: Role[]) {
    setSelectedRoleId(roleId);
    const role = roleList.find((item) => item.id === roleId);
    setAssignedPermissionIds(
      role?.permissions.map((item) => item.permission.id) ?? []
    );
  }

  const fetchData = useCallback(async () => {
    if (!token || !hospitalId) return;

    setIsLoading(true);
    setError("");

    try {
      const [hospitalResponse, usersResponse, rolesResponse, permissionsResponse] =
        await Promise.all([
          fetch(`/api/hospitals/${hospitalId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/users?hospitalId=${hospitalId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/roles?hospitalId=${hospitalId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/permissions", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

      const hospitalResult = (await hospitalResponse.json()) as ApiSuccess<Hospital> | ApiFailure;
      const usersResult = (await usersResponse.json()) as ApiSuccess<{ users: User[] }> | ApiFailure;
      const rolesResult = (await rolesResponse.json()) as ApiSuccess<{ roles: Role[] }> | ApiFailure;
      const permissionsResult = (await permissionsResponse.json()) as ApiSuccess<Permission[]> | ApiFailure;

      if (!hospitalResult.success) throw new Error(hospitalResult.message);
      if (!usersResult.success) throw new Error(usersResult.message);
      if (!rolesResult.success) throw new Error(rolesResult.message);
      if (!permissionsResult.success) throw new Error(permissionsResult.message);

      setHospital(hospitalResult.data);
      setHospitalForm({
        name: hospitalResult.data.name,
        subdomain: hospitalResult.data.subdomain,
      });
      setUsers(usersResult.data.users);
      setRoles(rolesResult.data.roles);
      setPermissions(permissionsResult.data);

      const firstRole = rolesResult.data.roles[0];
      const nextRoleId = selectedRoleId || firstRole?.id || "";
      if (nextRoleId) {
        syncSelectedRole(nextRoleId, rolesResult.data.roles);
      } else {
        setSelectedRoleId("");
        setAssignedPermissionIds([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load admin console");
    } finally {
      setIsLoading(false);
    }
  }, [hospitalId, selectedRoleId, token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  async function saveHospital(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingHospital(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/hospitals/${hospitalId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: hospitalForm.name,
          subdomain: hospitalForm.subdomain,
        }),
      });
      const result = (await response.json()) as ApiSuccess<Hospital> | ApiFailure;

      if (!result.success) {
        setError(result.message);
        return;
      }

      setHospital(result.data);
      setMessage("Hospital settings saved");
      await fetchData();
    } catch {
      setError("Unable to save hospital settings");
    } finally {
      setIsSavingHospital(false);
    }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingUser(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hospitalId,
          ...userForm,
        }),
      });
      const result = (await response.json()) as ApiSuccess<unknown> | ApiFailure;

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("User created");
      setUserForm(initialUserForm);
      await fetchData();
    } catch {
      setError("Unable to create user");
    } finally {
      setIsSavingUser(false);
    }
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingRole(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hospitalId,
          name: roleForm.name,
        }),
      });
      const result = (await response.json()) as ApiSuccess<unknown> | ApiFailure;

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("Role created");
      setRoleForm(initialRoleForm);
      await fetchData();
    } catch {
      setError("Unable to create role");
    } finally {
      setIsSavingRole(false);
    }
  }

  async function toggleUserActive(user: User) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: !user.isActive,
        }),
      });
      const result = (await response.json()) as ApiSuccess<User> | ApiFailure;

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(
        `${user.username} ${result.data.isActive ? "enabled" : "disabled"}`
      );
      await fetchData();
    } catch {
      setError("Unable to update user");
    }
  }

  async function assignRoleToUser(userId: string, roleId: string) {
    if (!roleId) return;

    setIsSavingUserRole(userId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/users/${userId}/roles`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roleId }),
      });
      const result = (await response.json()) as ApiSuccess<{ message: string }> | ApiFailure;

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.data.message);
      await fetchData();
    } catch {
      setError("Unable to assign role");
    } finally {
      setIsSavingUserRole("");
    }
  }

  function togglePermission(permissionId: string) {
    setAssignedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]
    );
  }

  async function savePermissions() {
    if (!selectedRole) return;

    setIsSavingPermissions(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/roles/${selectedRole.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          permissionIds: assignedPermissionIds,
        }),
      });
      const result = (await response.json()) as ApiSuccess<{ message: string }> | ApiFailure;

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.data.message);
      await fetchData();
    } catch {
      setError("Unable to save permissions");
    } finally {
      setIsSavingPermissions(false);
    }
  }

  if (!hospitalId) {
    return null;
  }

  return (
    <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Surface
        title="Hospital Settings"
        description={hospital ? `${hospital.name} / ${hospital.subdomain}` : "Tenant settings"}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fetchData}
              className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Refresh
            </button>
          </div>
        }
      >
        {isLoading ? (
          <p className="rounded-md border border-[#e3e7df] px-4 py-3 text-sm text-[#687067]">
            Loading hospital settings
          </p>
        ) : (
          <form onSubmit={saveHospital} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Hospital name
                <input
                  value={hospitalForm.name}
                  onChange={(event) =>
                    setHospitalForm({
                      ...hospitalForm,
                      name: event.target.value,
                    })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Subdomain
                <input
                  value={hospitalForm.subdomain}
                  onChange={(event) =>
                    setHospitalForm({
                      ...hospitalForm,
                      subdomain: event.target.value,
                    })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                  Users
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {users.length}
                </p>
              </div>
              <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                  Roles
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {roles.length}
                </p>
              </div>
              <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                  Permissions
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {permissions.length}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSavingHospital}
                className="h-10 rounded-md bg-[#2f5d50] px-4 text-sm font-semibold text-white transition hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingHospital ? "Saving" : "Save settings"}
              </button>
            </div>
          </form>
        )}
      </Surface>

      <Surface title="Hospital Users" description="Create and manage employees, users, and role assignments.">
        <form onSubmit={saveUser} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Username
              <input
                value={userForm.username}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    username: event.target.value,
                  })
                }
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                required
              />
            </label>
            <label className="text-sm font-medium">
              Password
              <input
                value={userForm.password}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    password: event.target.value,
                  })
                }
                type="password"
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                required
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Employee code
              <input
                value={userForm.employeeCode}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    employeeCode: event.target.value,
                  })
                }
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                required
              />
            </label>
            <label className="text-sm font-medium">
              Full name
              <input
                value={userForm.fullName}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    fullName: event.target.value,
                  })
                }
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                required
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Designation
              <input
                value={userForm.designation}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    designation: event.target.value,
                  })
                }
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                required
              />
            </label>
            <label className="text-sm font-medium">
              Department
              <input
                value={userForm.department}
                onChange={(event) =>
                  setUserForm({
                    ...userForm,
                    department: event.target.value,
                  })
                }
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSavingUser}
              className="h-10 rounded-md bg-[#2f5d50] px-4 text-sm font-semibold text-white transition hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingUser ? "Saving" : "Create user"}
            </button>
          </div>
        </form>

        <div className="mt-5 grid gap-3 border-t border-[#e3e7df] pt-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-semibold">Users</h3>
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              className="h-9 w-56 rounded-md border border-[#cfd6ca] px-3 text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              placeholder="Search users"
            />
          </div>

          <div className="grid gap-3">
            {filteredUsers.length === 0 ? (
              <p className="rounded-md border border-[#e3e7df] px-4 py-3 text-sm text-[#687067]">
                No users found
              </p>
            ) : (
              filteredUsers.map((user) => {
                const roleOptions = roles;
                return (
                  <div
                    key={user.id}
                    className="rounded-md border border-[#e3e7df] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#2f5d50]">
                            {user.username}
                          </span>
                          <span className={`rounded-md px-2 py-1 text-xs font-medium ${user.isActive ? "bg-[#eef8f1] text-[#27603a]" : "bg-[#fff0ef] text-[#9f2d24]"}`}>
                            {user.isActive ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#687067]">
                          {user.employee?.employeeCode ?? "Employee not linked"} / {user.employee?.fullName ?? "Not set"}
                        </p>
                        <p className="mt-1 text-sm">
                          {user.employee?.designation ?? "Not set"}
                          {user.employee?.department ? ` / ${user.employee.department}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {user.roles.length === 0 ? (
                            <span className="text-sm text-[#687067]">No roles assigned</span>
                          ) : (
                            user.roles.map((assignment) => (
                              <span
                                key={assignment.roleId}
                                className="rounded-md bg-[#eef3eb] px-2 py-1 text-xs font-medium text-[#4b5f43]"
                              >
                                {assignment.role.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:items-end">
                        <div className="flex flex-wrap gap-2">
                          <select
                            className="h-8 rounded-md border border-[#cfd6ca] bg-white px-3 text-xs outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                            defaultValue=""
                            onChange={(event) =>
                              assignRoleToUser(
                                user.id,
                                event.target.value
                              )
                            }
                          >
                            <option value="">Assign role</option>
                            {roleOptions.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => toggleUserActive(user)}
                            className="h-8 rounded-md border border-[#cfd6ca] px-3 text-xs font-medium hover:bg-[#f1f3ee]"
                          >
                            {user.isActive ? "Disable" : "Enable"}
                          </button>
                        </div>
                        {isSavingUserRole === user.id ? (
                          <p className="text-xs text-[#687067]">Saving role assignment</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Surface>

      <Surface title="Roles & Permissions" description="Create roles and assign permissions for the tenant.">
        <form onSubmit={saveRole} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-sm font-medium">
              Role name
              <input
                value={roleForm.name}
                onChange={(event) =>
                  setRoleForm({
                    ...roleForm,
                    name: event.target.value,
                  })
                }
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                required
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSavingRole}
                className="h-10 rounded-md bg-[#2f5d50] px-4 text-sm font-semibold text-white transition hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingRole ? "Saving" : "Create role"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-5 grid gap-3 border-t border-[#e3e7df] pt-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-semibold">Role directory</h3>
            <input
              value={roleSearch}
              onChange={(event) => setRoleSearch(event.target.value)}
              className="h-9 w-56 rounded-md border border-[#cfd6ca] px-3 text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              placeholder="Search roles"
            />
          </div>

          <div className="grid gap-3">
            {filteredRoles.length === 0 ? (
              <p className="rounded-md border border-[#e3e7df] px-4 py-3 text-sm text-[#687067]">
                No roles found
              </p>
            ) : (
              filteredRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => syncSelectedRole(role.id, roles)}
                  className={`rounded-md border p-4 text-left transition ${
                    selectedRoleId === role.id
                      ? "border-[#477063] bg-[#f2f7f4]"
                      : "border-[#e3e7df] hover:bg-[#fbfcfa]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#2f5d50]">{role.name}</span>
                    <span className="rounded-md bg-[#eef3eb] px-2 py-1 text-xs font-medium text-[#4b5f43]">
                      {role.permissions.length} permissions
                    </span>
                    <span className="rounded-md bg-[#eef3eb] px-2 py-1 text-xs font-medium text-[#4b5f43]">
                      {role.users?.length ?? 0} users
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedRole ? (
          <div className="mt-5 border-t border-[#e3e7df] pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold">{selectedRole.name}</h3>
                <p className="text-sm text-[#687067]">
                  Permissions assigned to this role
                </p>
              </div>
              <button
                type="button"
                onClick={savePermissions}
                disabled={isSavingPermissions}
                className="h-9 rounded-md bg-[#2f5d50] px-3 text-sm font-semibold text-white transition hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingPermissions ? "Saving" : "Save permissions"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {permissions.map((permission) => {
                const checked = assignedPermissionIds.includes(permission.id);

                return (
                  <label
                    key={permission.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-[#e3e7df] p-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(permission.id)}
                      className="mt-1 h-4 w-4 rounded border-[#cfd6ca]"
                    />
                    <div>
                      <p className="font-medium">{permission.code}</p>
                      <p className="text-sm text-[#687067]">
                        {permission.description ?? formatEnum(permission.code)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </Surface>

      {message ? (
        <p className="xl:col-span-2 rounded-md bg-[#eef8f1] px-3 py-2 text-sm text-[#27603a]">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="xl:col-span-2 rounded-md bg-[#fff0ef] px-3 py-2 text-sm text-[#9f2d24]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
