"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Surface } from "@/components/ui/surface";

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  message: string;
};

type AuthUser = {
  userType: string;
  hospitalId: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
  address?: string | null;
  city?: string | null;
  state?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  allergies?: string | null;
  remarks?: string | null;
  isActive: boolean;
};

type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string;
  department?: string | null;
};

type RadiologyOrderItem = {
  id: string;
  procedureName: string;
  bodyPart?: string | null;
  laterality?: string | null;
  findings?: string | null;
  remarks?: string | null;
};

type RadiologyOrder = {
  id: string;
  orderNo: string;
  status: string;
  priority: string;
  notes?: string | null;
  createdAt: string;
  patient?: Patient;
  opdVisit?: {
    id: string;
    visitNo: string;
    appointment?: {
      id: string;
      appointmentNo: string;
      appointmentAt: string;
    } | null;
  } | null;
  requestedBy?: Employee | null;
  items: RadiologyOrderItem[];
};

type RadiologyItemDraft = {
  procedureName: string;
  bodyPart: string;
  laterality: string;
  findings: string;
  remarks: string;
};

const blankRadiologyItem: RadiologyItemDraft = {
  procedureName: "",
  bodyPart: "",
  laterality: "",
  findings: "",
  remarks: "",
};

const radiologyStatuses = [
  "REQUESTED",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
];

const radiologyPriorities = ["ROUTINE", "URGENT", "STAT"];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function patientName(patient?: Patient | null) {
  if (!patient) {
    return "Not set";
  }

  return [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean)
    .join(" ");
}

type RadiologyConsoleProps = {
  token: string;
  user: AuthUser;
  effectiveHospitalId: string;
  patients: Patient[];
  selectedPatient: Patient | null;
  activeOpdVisit: { id: string; visitNo: string } | null;
  employees: Employee[];
  onOpenPatient: (patient: Patient) => void;
};

export function RadiologyConsole({
  token,
  user,
  effectiveHospitalId,
  patients,
  selectedPatient,
  activeOpdVisit,
  employees,
  onOpenPatient,
}: RadiologyConsoleProps) {
  const [orders, setOrders] = useState<RadiologyOrder[]>([]);
  const [selectedOrder, setSelectedOrder] =
    useState<RadiologyOrder | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(false);

  const [patientOrders, setPatientOrders] = useState<RadiologyOrder[]>([]);
  const [patientPage, setPatientPage] = useState(1);
  const [patientPagination, setPatientPagination] = useState<Pagination>({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1,
  });
  const [isLoadingPatientOrders, setIsLoadingPatientOrders] =
    useState(false);

  const [patientId, setPatientId] = useState("");
  const [visitId, setVisitId] = useState("");
  const [requesterId, setRequesterId] = useState("");
  const [orderStatus, setOrderStatus] = useState("REQUESTED");
  const [orderPriority, setOrderPriority] = useState("ROUTINE");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<RadiologyItemDraft[]>([
    blankRadiologyItem,
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const patientOptions = useMemo(() => {
    const options = [...patients];

    if (
      selectedPatient &&
      !options.some((patient) => patient.id === selectedPatient.id)
    ) {
      options.unshift(selectedPatient);
    }

    return options;
  }, [patients, selectedPatient]);

  const fetchOrders = useCallback(async () => {
    if (!token || !user || !effectiveHospitalId) {
      setOrders([]);
      return;
    }

    setIsLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
    });

    if (search) {
      params.set("search", search);
    }

    if (status) {
      params.set("status", status);
    }

    if (priority) {
      params.set("priority", priority);
    }

    if (user.userType === "SUPER_ADMIN") {
      params.set("hospitalId", effectiveHospitalId);
    }

    try {
      const response = await fetch(
        `/api/radiology-orders?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const result = (await response.json()) as
        | ApiSuccess<{
            radiologyOrders: RadiologyOrder[];
            pagination: Pagination;
          }>
        | ApiFailure;

      if (result.success) {
        setOrders(result.data.radiologyOrders);
        setPagination({
          ...result.data.pagination,
          totalPages: Math.max(result.data.pagination.totalPages, 1),
        });
      }
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveHospitalId, page, priority, search, status, token, user]);

  const fetchPatientOrders = useCallback(async () => {
    if (!token || !user || !effectiveHospitalId || !selectedPatient) {
      setPatientOrders([]);
      return;
    }

    setIsLoadingPatientOrders(true);

    const params = new URLSearchParams({
      patientId: selectedPatient.id,
      page: String(patientPage),
      limit: "5",
    });

    if (user.userType === "SUPER_ADMIN") {
      params.set("hospitalId", effectiveHospitalId);
    }

    try {
      const response = await fetch(
        `/api/radiology-orders?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const result = (await response.json()) as
        | ApiSuccess<{
            radiologyOrders: RadiologyOrder[];
            pagination: Pagination;
          }>
        | ApiFailure;

      if (result.success) {
        setPatientOrders(result.data.radiologyOrders);
        setPatientPagination({
          ...result.data.pagination,
          totalPages: Math.max(result.data.pagination.totalPages, 1),
        });
      }
    } catch {
      setPatientOrders([]);
    } finally {
      setIsLoadingPatientOrders(false);
    }
  }, [effectiveHospitalId, patientPage, selectedPatient, token, user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchOrders();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchOrders]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchPatientOrders();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchPatientOrders]);

  function addItemRow() {
    setItems((current) => [...current, { ...blankRadiologyItem }]);
  }

  function updateItemRow(
    index: number,
    field: keyof RadiologyItemDraft,
    value: string
  ) {
    setItems((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  }

  function removeItemRow(index: number) {
    setItems((current) => {
      if (current.length === 1) {
        return [{ ...blankRadiologyItem }];
      }

      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }

  function resetForm() {
    setItems([{ ...blankRadiologyItem }]);
    setPatientId("");
    setVisitId("");
    setRequesterId("");
    setOrderStatus("REQUESTED");
    setOrderPriority("ROUTINE");
    setNotes("");
    setMessage("");
    setError("");
  }

  function openOrder(order: RadiologyOrder) {
    setSelectedOrder(order);
    setError("");
    setMessage("");
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const targetPatientId = patientId || selectedPatient?.id || "";
    const targetVisitId = visitId || activeOpdVisit?.id || "";
    const targetRequesterId = requesterId || employees[0]?.id || "";

    if (!targetPatientId) {
      setError("Select a patient first");
      return;
    }

    const payloadItems = items
      .map((item) => ({
        procedureName: item.procedureName.trim(),
        bodyPart: item.bodyPart.trim() || undefined,
        laterality: item.laterality.trim() || undefined,
        findings: item.findings.trim() || undefined,
        remarks: item.remarks.trim() || undefined,
      }))
      .filter((item) => item.procedureName);

    if (!payloadItems.length) {
      setError("Add at least one procedure");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/radiology-orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hospitalId:
            user.userType === "SUPER_ADMIN"
              ? effectiveHospitalId
              : undefined,
          patientId: targetPatientId,
          opdVisitId: targetVisitId || undefined,
          requestedByEmployeeId: targetRequesterId || undefined,
          notes: notes || undefined,
          status: orderStatus,
          priority: orderPriority,
          items: payloadItems,
        }),
      });
      const result = (await response.json()) as
        | ApiSuccess<RadiologyOrder>
        | ApiFailure;

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(`${result.data.orderNo} created`);
      setSelectedOrder(result.data);
      resetForm();
      await fetchOrders();
      await fetchPatientOrders();
    } catch {
      setError("Unable to save radiology order");
    } finally {
      setIsSaving(false);
    }
  }

  function printOrder() {
    window.print();
  }

  return (
    <div className="grid gap-5">
      <Surface
        title="Radiology orders"
        description="Request imaging, track reports, and keep the patient chart moving"
        actions={
          <div className="flex flex-wrap gap-2">
            {selectedPatient ? (
              <button
                type="button"
                onClick={() => onOpenPatient(selectedPatient)}
                className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
              >
                Open current patient
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPage(1)}
              className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Refresh list
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Orders
            </p>
            <p className="mt-1 text-xl font-semibold">{orders.length}</p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Requested
            </p>
            <p className="mt-1 text-xl font-semibold">
              {orders.filter((order) => order.status === "REQUESTED").length}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Scheduled
            </p>
            <p className="mt-1 text-xl font-semibold">
              {orders.filter((order) => order.status === "SCHEDULED").length}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Completed
            </p>
            <p className="mt-1 text-xl font-semibold">
              {orders.filter((order) => order.status === "COMPLETED").length}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Patient history
            </p>
            <p className="mt-1 text-xl font-semibold">{patientOrders.length}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.5fr_0.9fr_0.7fr]">
          <label className="text-sm font-medium">
            Search
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              placeholder="Order no, notes, procedure"
            />
          </label>

          <label className="text-sm font-medium">
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
            >
              <option value="">All statuses</option>
              {radiologyStatuses.map((item) => (
                <option key={item} value={item}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Priority
            <select
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
              className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
            >
              <option value="">All priorities</option>
              {radiologyPriorities.map((item) => (
                <option key={item} value={item}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 overflow-hidden rounded-md border border-[#e3e7df]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-[#f3f5f0] text-xs uppercase tracking-[0.08em] text-[#687067]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">OPD</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Requested by</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#687067]">
                      Loading radiology orders...
                    </td>
                  </tr>
                ) : orders.length ? (
                  orders.map((order) => (
                    <tr key={order.id} className="border-t border-[#edf0e9]">
                      <td className="px-4 py-3 font-medium">
                        <div>{order.orderNo}</div>
                        <div className="mt-1 text-xs text-[#687067]">
                          {formatDateTime(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">{patientName(order.patient)}</td>
                      <td className="px-4 py-3">
                        {order.opdVisit?.visitNo ?? "Not linked"}
                      </td>
                      <td className="px-4 py-3">{formatLabel(order.priority)}</td>
                      <td className="px-4 py-3">{formatLabel(order.status)}</td>
                      <td className="px-4 py-3">
                        {order.requestedBy?.fullName ?? "Not set"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openOrder(order)}
                            className="h-8 rounded-md border border-[#cfd6ca] px-3 text-xs font-medium hover:bg-[#f1f3ee]"
                          >
                            Open
                          </button>
                          {order.patient ? (
                            <button
                              type="button"
                              onClick={() => onOpenPatient(order.patient!)}
                              className="h-8 rounded-md border border-[#cfd6ca] px-3 text-xs font-medium hover:bg-[#f1f3ee]"
                            >
                              Patient
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#687067]">
                      No radiology orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e3e7df] px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#687067]">
            Page {page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(pagination.totalPages, current + 1)
                )
              }
              disabled={page >= pagination.totalPages}
              className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </Surface>

      {selectedOrder ? (
        <Surface
          printSection="radiology-summary"
          title="Radiology order summary"
          description={`${selectedOrder.orderNo} / ${formatDateTime(selectedOrder.createdAt)}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={printOrder}
                className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Patient
              </p>
              <p className="mt-1 font-semibold">{patientName(selectedOrder.patient)}</p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                OPD visit
              </p>
              <p className="mt-1 font-semibold">
                {selectedOrder.opdVisit?.visitNo ?? "Not linked"}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Status
              </p>
              <p className="mt-1 font-semibold">{formatLabel(selectedOrder.status)}</p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Priority
              </p>
              <p className="mt-1 font-semibold">
                {formatLabel(selectedOrder.priority)}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-[#e3e7df]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f3f5f0] text-xs uppercase tracking-[0.08em] text-[#687067]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Procedure</th>
                  <th className="px-3 py-2 font-semibold">Body part</th>
                  <th className="px-3 py-2 font-semibold">Laterality</th>
                  <th className="px-3 py-2 font-semibold">Findings</th>
                  <th className="px-3 py-2 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items.map((item) => (
                  <tr key={item.id} className="border-t border-[#edf0e9]">
                    <td className="px-3 py-2">{item.procedureName}</td>
                    <td className="px-3 py-2">{item.bodyPart ?? "NA"}</td>
                    <td className="px-3 py-2">{item.laterality ?? "NA"}</td>
                    <td className="px-3 py-2">{item.findings ?? "Pending"}</td>
                    <td className="px-3 py-2">{item.remarks ?? "NA"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedOrder.notes ? (
            <p className="mt-4 rounded-md border border-[#e3e7df] bg-[#fbfcfa] px-3 py-2 text-sm text-[#687067]">
              {selectedOrder.notes}
            </p>
          ) : null}
        </Surface>
      ) : null}

      <Surface
        title="Create radiology order"
        description="Request imaging from the current patient or active OPD"
      >
        <form onSubmit={saveOrder} className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
            <label className="text-sm font-medium">
              Patient
              <select
                value={patientId || selectedPatient?.id || ""}
                onChange={(event) => setPatientId(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              >
                <option value="">Select patient</option>
                {patientOptions.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patientName(patient)} ({patient.patientCode})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              OPD visit
              <input
                value={visitId || activeOpdVisit?.id || ""}
                onChange={(event) => setVisitId(event.target.value)}
                placeholder={activeOpdVisit?.visitNo ?? "Optional"}
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              />
            </label>

            <label className="text-sm font-medium">
              Requested by
              <select
                value={requesterId || employees[0]?.id || ""}
                onChange={(event) => setRequesterId(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              >
                <option value="">Not set</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Status
              <select
                value={orderStatus}
                onChange={(event) => setOrderStatus(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              >
                {radiologyStatuses.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Priority
              <select
                value={orderPriority}
                onChange={(event) => setOrderPriority(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              >
                {radiologyPriorities.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3">
            {items.map((row, index) => (
              <div
                key={`${index}-${row.procedureName}`}
                className="grid gap-3 rounded-md border border-[#e3e7df] p-3 lg:grid-cols-[1.7fr_0.9fr_0.9fr_0.9fr_auto]"
              >
                <label className="text-sm font-medium">
                  Procedure
                  <input
                    value={row.procedureName}
                    onChange={(event) =>
                      updateItemRow(index, "procedureName", event.target.value)
                    }
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                    placeholder="Chest X-Ray"
                    required
                  />
                </label>

                <label className="text-sm font-medium">
                  Body part
                  <input
                    value={row.bodyPart}
                    onChange={(event) =>
                      updateItemRow(index, "bodyPart", event.target.value)
                    }
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                    placeholder="Chest"
                  />
                </label>

                <label className="text-sm font-medium">
                  Laterality
                  <input
                    value={row.laterality}
                    onChange={(event) =>
                      updateItemRow(index, "laterality", event.target.value)
                    }
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                    placeholder="Left / Right / Bilateral"
                  />
                </label>

                <label className="text-sm font-medium">
                  Findings
                  <input
                    value={row.findings}
                    onChange={(event) =>
                      updateItemRow(index, "findings", event.target.value)
                    }
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                    placeholder="Pending"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removeItemRow(index)}
                  className="mt-6 h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addItemRow}
              className="h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Add procedure
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Reset
            </button>
          </div>

          <label className="text-sm font-medium">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-2 min-h-20 w-full rounded-md border border-[#cfd6ca] px-3 py-2 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
            />
          </label>

          {message ? (
            <p className="rounded-md bg-[#eef8f1] px-3 py-2 text-sm text-[#27603a]">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-md bg-[#fff0ef] px-3 py-2 text-sm text-[#9f2d24]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="h-11 rounded-md bg-[#2f5d50] px-4 text-sm font-semibold text-white transition hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving radiology order" : "Create radiology order"}
            </button>
          </div>
        </form>
      </Surface>

      {selectedPatient ? (
        <Surface
          title="Patient radiology history"
          description={`${patientName(selectedPatient)} / ${selectedPatient.patientCode}`}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Orders
              </p>
              <p className="mt-1 text-xl font-semibold">{patientOrders.length}</p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Pending
              </p>
              <p className="mt-1 text-xl font-semibold">
                {
                  patientOrders.filter(
                    (order) => order.status !== "COMPLETED"
                  ).length
                }
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Completed
              </p>
              <p className="mt-1 text-xl font-semibold">
                {
                  patientOrders.filter(
                    (order) => order.status === "COMPLETED"
                  ).length
                }
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-[#e3e7df]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-[#f3f5f0] text-xs uppercase tracking-[0.08em] text-[#687067]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingPatientOrders ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-[#687067]"
                      >
                        Loading patient radiology orders...
                      </td>
                    </tr>
                  ) : patientOrders.length ? (
                    patientOrders.map((order) => (
                      <tr key={order.id} className="border-t border-[#edf0e9]">
                        <td className="px-4 py-3 font-medium">
                          {order.orderNo}
                        </td>
                        <td className="px-4 py-3">
                          {formatDateTime(order.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {formatLabel(order.priority)}
                        </td>
                        <td className="px-4 py-3">
                          {formatLabel(order.status)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openOrder(order)}
                            className="h-8 rounded-md border border-[#cfd6ca] px-3 text-xs font-medium hover:bg-[#f1f3ee]"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-[#687067]"
                      >
                        No radiology history for this patient
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#e3e7df] px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#687067]">
              Page {patientPage} of {patientPagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPatientPage((current) => Math.max(1, current - 1))}
                disabled={patientPage <= 1}
                className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPatientPage((current) =>
                    Math.min(patientPagination.totalPages, current + 1)
                  )
                }
                disabled={patientPage >= patientPagination.totalPages}
                className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
