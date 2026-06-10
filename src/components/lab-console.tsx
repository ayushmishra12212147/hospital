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

type LabOrderItem = {
  id: string;
  testName: string;
  specimenType?: string | null;
  resultValue?: string | null;
  unit?: string | null;
  referenceRange?: string | null;
  remarks?: string | null;
};

type LabOrder = {
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
  items: LabOrderItem[];
};

type LabItemDraft = {
  testName: string;
  specimenType: string;
  resultValue: string;
  unit: string;
  referenceRange: string;
  remarks: string;
};

const blankLabItem: LabItemDraft = {
  testName: "",
  specimenType: "",
  resultValue: "",
  unit: "",
  referenceRange: "",
  remarks: "",
};

const labStatuses = [
  "REQUESTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const labPriorities = ["ROUTINE", "URGENT", "STAT"];

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

type LabConsoleProps = {
  token: string;
  user: AuthUser;
  effectiveHospitalId: string;
  patients: Patient[];
  selectedPatient: Patient | null;
  activeOpdVisit: { id: string; visitNo: string } | null;
  employees: Employee[];
  onOpenPatient: (patient: Patient) => void;
};

export function LabConsole({
  token,
  user,
  effectiveHospitalId,
  patients,
  selectedPatient,
  activeOpdVisit,
  employees,
  onOpenPatient,
}: LabConsoleProps) {
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [selectedLabOrder, setSelectedLabOrder] =
    useState<LabOrder | null>(null);
  const [labSearch, setLabSearch] = useState("");
  const [labStatus, setLabStatus] = useState("");
  const [labPriority, setLabPriority] = useState("");
  const [labPage, setLabPage] = useState(1);
  const [labPagination, setLabPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoadingLabOrders, setIsLoadingLabOrders] = useState(false);

  const [patientLabOrders, setPatientLabOrders] = useState<LabOrder[]>([]);
  const [patientLabPage, setPatientLabPage] = useState(1);
  const [patientLabPagination, setPatientLabPagination] =
    useState<Pagination>({
      page: 1,
      limit: 5,
      total: 0,
      totalPages: 1,
    });
  const [isLoadingPatientLabOrders, setIsLoadingPatientLabOrders] =
    useState(false);

  const [labPatientId, setLabPatientId] = useState("");
  const [labVisitId, setLabVisitId] = useState("");
  const [labRequesterId, setLabRequesterId] = useState("");
  const [labOrderStatus, setLabOrderStatus] = useState("REQUESTED");
  const [labOrderPriority, setLabOrderPriority] = useState("ROUTINE");
  const [labNotes, setLabNotes] = useState("");
  const [labItems, setLabItems] = useState<LabItemDraft[]>([
    blankLabItem,
  ]);
  const [isSavingLabOrder, setIsSavingLabOrder] = useState(false);
  const [labMessage, setLabMessage] = useState("");
  const [labError, setLabError] = useState("");

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

  const fetchLabOrders = useCallback(async () => {
    if (!token || !user || !effectiveHospitalId) {
      setLabOrders([]);
      return;
    }

    setIsLoadingLabOrders(true);

    const params = new URLSearchParams({
      page: String(labPage),
      limit: "10",
    });

    if (labSearch) {
      params.set("search", labSearch);
    }

    if (labStatus) {
      params.set("status", labStatus);
    }

    if (labPriority) {
      params.set("priority", labPriority);
    }

    if (user.userType === "SUPER_ADMIN") {
      params.set("hospitalId", effectiveHospitalId);
    }

    try {
      const response = await fetch(
        `/api/lab-orders?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const result = (await response.json()) as
        | ApiSuccess<{
            labOrders: LabOrder[];
            pagination: Pagination;
          }>
        | ApiFailure;

      if (result.success) {
        setLabOrders(result.data.labOrders);
        setLabPagination({
          ...result.data.pagination,
          totalPages: Math.max(result.data.pagination.totalPages, 1),
        });
      }
    } catch {
      setLabOrders([]);
    } finally {
      setIsLoadingLabOrders(false);
    }
  }, [
    effectiveHospitalId,
    labPage,
    labPriority,
    labSearch,
    labStatus,
    token,
    user,
  ]);

  const fetchPatientLabOrders = useCallback(async () => {
    if (!token || !user || !effectiveHospitalId || !selectedPatient) {
      setPatientLabOrders([]);
      return;
    }

    setIsLoadingPatientLabOrders(true);

    const params = new URLSearchParams({
      patientId: selectedPatient.id,
      page: String(patientLabPage),
      limit: "5",
    });

    if (user.userType === "SUPER_ADMIN") {
      params.set("hospitalId", effectiveHospitalId);
    }

    try {
      const response = await fetch(
        `/api/lab-orders?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const result = (await response.json()) as
        | ApiSuccess<{
            labOrders: LabOrder[];
            pagination: Pagination;
          }>
        | ApiFailure;

      if (result.success) {
        setPatientLabOrders(result.data.labOrders);
        setPatientLabPagination({
          ...result.data.pagination,
          totalPages: Math.max(result.data.pagination.totalPages, 1),
        });
      }
    } catch {
      setPatientLabOrders([]);
    } finally {
      setIsLoadingPatientLabOrders(false);
    }
  }, [
    effectiveHospitalId,
    patientLabPage,
    selectedPatient,
    token,
    user,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchLabOrders();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchLabOrders]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchPatientLabOrders();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchPatientLabOrders]);

  function addLabItemRow() {
    setLabItems((current) => [...current, { ...blankLabItem }]);
  }

  function updateLabItemRow(
    index: number,
    field: keyof LabItemDraft,
    value: string
  ) {
    setLabItems((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  }

  function removeLabItemRow(index: number) {
    setLabItems((current) => {
      if (current.length === 1) {
        return [{ ...blankLabItem }];
      }

      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }

  function resetLabForm() {
    setLabItems([{ ...blankLabItem }]);
    setLabNotes("");
    setLabOrderStatus("REQUESTED");
    setLabOrderPriority("ROUTINE");
    setLabPatientId("");
    setLabVisitId("");
    setLabRequesterId("");
    setLabMessage("");
    setLabError("");
  }

  function openLabOrder(order: LabOrder) {
    setSelectedLabOrder(order);
    setLabError("");
    setLabMessage("");
  }

  async function saveLabOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const targetPatientId = labPatientId || selectedPatient?.id || "";
    const targetVisitId = labVisitId || activeOpdVisit?.id || "";
    const targetRequesterId =
      labRequesterId || employees[0]?.id || "";

    if (!targetPatientId) {
      setLabError("Select a patient first");
      return;
    }

    const items = labItems
      .map((item) => ({
        testName: item.testName.trim(),
        specimenType: item.specimenType.trim() || undefined,
        resultValue: item.resultValue.trim() || undefined,
        unit: item.unit.trim() || undefined,
        referenceRange: item.referenceRange.trim() || undefined,
        remarks: item.remarks.trim() || undefined,
      }))
      .filter((item) => item.testName);

    if (!items.length) {
      setLabError("Add at least one test");
      return;
    }

    setIsSavingLabOrder(true);
    setLabError("");
    setLabMessage("");

    try {
      const response = await fetch("/api/lab-orders", {
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
          notes: labNotes || undefined,
          status: labOrderStatus,
          priority: labOrderPriority,
          items,
        }),
      });
      const result = (await response.json()) as
        | ApiSuccess<LabOrder>
        | ApiFailure;

      if (!result.success) {
        setLabError(result.message);
        return;
      }

      setLabMessage(`${result.data.orderNo} created`);
      setSelectedLabOrder(result.data);
      resetLabForm();
      await fetchLabOrders();
      await fetchPatientLabOrders();
    } catch {
      setLabError("Unable to save lab order");
    } finally {
      setIsSavingLabOrder(false);
    }
  }

  function printLabOrder() {
    window.print();
  }

  const currentPatientOrders = selectedPatient ? patientLabOrders : [];

  return (
    <div className="grid gap-5">
      <Surface
        title="Lab orders"
        description="Request tests, track results, and keep the patient chart moving"
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
              onClick={() => setLabPage(1)}
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
            <p className="mt-1 text-xl font-semibold">{labOrders.length}</p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Requested
            </p>
            <p className="mt-1 text-xl font-semibold">
              {labOrders.filter((order) => order.status === "REQUESTED").length}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              In progress
            </p>
            <p className="mt-1 text-xl font-semibold">
              {labOrders.filter((order) => order.status === "IN_PROGRESS").length}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Completed
            </p>
            <p className="mt-1 text-xl font-semibold">
              {labOrders.filter((order) => order.status === "COMPLETED").length}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Visible patient tests
            </p>
            <p className="mt-1 text-xl font-semibold">
              {currentPatientOrders.length}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.5fr_0.9fr_0.7fr]">
          <label className="text-sm font-medium">
            Search
            <input
              value={labSearch}
              onChange={(event) => {
                setLabSearch(event.target.value);
                setLabPage(1);
              }}
              className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              placeholder="Order no, notes, test name"
            />
          </label>

          <label className="text-sm font-medium">
            Status
            <select
              value={labStatus}
              onChange={(event) => {
                setLabStatus(event.target.value);
                setLabPage(1);
              }}
              className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
            >
              <option value="">All statuses</option>
              {labStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Priority
            <select
              value={labPriority}
              onChange={(event) => {
                setLabPriority(event.target.value);
                setLabPage(1);
              }}
              className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
            >
              <option value="">All priorities</option>
              {labPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {formatLabel(priority)}
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
                {isLoadingLabOrders ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-[#687067]"
                    >
                      Loading lab orders...
                    </td>
                  </tr>
                ) : labOrders.length ? (
                  labOrders.map((order) => (
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
                            onClick={() => openLabOrder(order)}
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
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-[#687067]"
                    >
                      No lab orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e3e7df] px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#687067]">
            Page {labPage} of {labPagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLabPage((current) => Math.max(1, current - 1))}
              disabled={labPage <= 1}
              className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setLabPage((current) =>
                  Math.min(labPagination.totalPages, current + 1)
                )
              }
              disabled={labPage >= labPagination.totalPages}
              className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </Surface>

      {selectedLabOrder ? (
        <Surface
          printSection="lab-summary"
          title="Lab order summary"
          description={`${selectedLabOrder.orderNo} / ${formatDateTime(selectedLabOrder.createdAt)}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={printLabOrder}
                className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setSelectedLabOrder(null)}
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
              <p className="mt-1 font-semibold">
                {patientName(selectedLabOrder.patient)}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                OPD visit
              </p>
              <p className="mt-1 font-semibold">
                {selectedLabOrder.opdVisit?.visitNo ?? "Not linked"}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Status
              </p>
              <p className="mt-1 font-semibold">
                {formatLabel(selectedLabOrder.status)}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Priority
              </p>
              <p className="mt-1 font-semibold">
                {formatLabel(selectedLabOrder.priority)}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-[#e3e7df]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f3f5f0] text-xs uppercase tracking-[0.08em] text-[#687067]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Test</th>
                  <th className="px-3 py-2 font-semibold">Specimen</th>
                  <th className="px-3 py-2 font-semibold">Result</th>
                  <th className="px-3 py-2 font-semibold">Unit</th>
                  <th className="px-3 py-2 font-semibold">Range</th>
                  <th className="px-3 py-2 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {selectedLabOrder.items.map((item) => (
                  <tr key={item.id} className="border-t border-[#edf0e9]">
                    <td className="px-3 py-2">{item.testName}</td>
                    <td className="px-3 py-2">{item.specimenType ?? "NA"}</td>
                    <td className="px-3 py-2">{item.resultValue ?? "Pending"}</td>
                    <td className="px-3 py-2">{item.unit ?? "NA"}</td>
                    <td className="px-3 py-2">{item.referenceRange ?? "NA"}</td>
                    <td className="px-3 py-2">{item.remarks ?? "NA"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedLabOrder.notes ? (
            <p className="mt-4 rounded-md border border-[#e3e7df] bg-[#fbfcfa] px-3 py-2 text-sm text-[#687067]">
              {selectedLabOrder.notes}
            </p>
          ) : null}
        </Surface>
      ) : null}

      <Surface
        title="Create lab order"
        description="Request investigations from the same patient or the current OPD visit"
      >
        <form onSubmit={saveLabOrder} className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
            <label className="text-sm font-medium">
              Patient
              <select
                value={labPatientId || selectedPatient?.id || ""}
                onChange={(event) => setLabPatientId(event.target.value)}
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
                value={labVisitId || activeOpdVisit?.id || ""}
                onChange={(event) => setLabVisitId(event.target.value)}
                placeholder={activeOpdVisit?.visitNo ?? "Optional"}
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              />
            </label>

            <label className="text-sm font-medium">
              Requested by
              <select
                value={labRequesterId || employees[0]?.id || ""}
                onChange={(event) => setLabRequesterId(event.target.value)}
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
                value={labOrderStatus}
                onChange={(event) => setLabOrderStatus(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              >
                {labStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Priority
              <select
                value={labOrderPriority}
                onChange={(event) => setLabOrderPriority(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              >
                {labPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {formatLabel(priority)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3">
            {labItems.map((row, index) => (
              <div
                key={`${index}-${row.testName}`}
                className="grid gap-3 rounded-md border border-[#e3e7df] p-3 lg:grid-cols-[1.7fr_0.9fr_0.9fr_0.7fr_auto]"
              >
                <label className="text-sm font-medium">
                  Test name
                  <input
                    value={row.testName}
                    onChange={(event) =>
                      updateLabItemRow(index, "testName", event.target.value)
                    }
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                    placeholder="CBC"
                    required
                  />
                </label>

                <label className="text-sm font-medium">
                  Specimen
                  <input
                    value={row.specimenType}
                    onChange={(event) =>
                      updateLabItemRow(
                        index,
                        "specimenType",
                        event.target.value
                      )
                    }
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                    placeholder="Blood"
                  />
                </label>

                <label className="text-sm font-medium">
                  Result
                  <input
                    value={row.resultValue}
                    onChange={(event) =>
                      updateLabItemRow(
                        index,
                        "resultValue",
                        event.target.value
                      )
                    }
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                    placeholder="Pending"
                  />
                </label>

                <label className="text-sm font-medium">
                  Unit
                  <input
                    value={row.unit}
                    onChange={(event) =>
                      updateLabItemRow(index, "unit", event.target.value)
                    }
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                    placeholder="mg/dL"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removeLabItemRow(index)}
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
              onClick={addLabItemRow}
              className="h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Add test
            </button>
            <button
              type="button"
              onClick={resetLabForm}
              className="h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Reset
            </button>
          </div>

          <label className="text-sm font-medium">
            Notes
            <textarea
              value={labNotes}
              onChange={(event) => setLabNotes(event.target.value)}
              className="mt-2 min-h-20 w-full rounded-md border border-[#cfd6ca] px-3 py-2 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
            />
          </label>

          {labMessage ? (
            <p className="rounded-md bg-[#eef8f1] px-3 py-2 text-sm text-[#27603a]">
              {labMessage}
            </p>
          ) : null}

          {labError ? (
            <p className="rounded-md bg-[#fff0ef] px-3 py-2 text-sm text-[#9f2d24]">
              {labError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSavingLabOrder}
              className="h-11 rounded-md bg-[#2f5d50] px-4 text-sm font-semibold text-white transition hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingLabOrder ? "Saving lab order" : "Create lab order"}
            </button>
          </div>
        </form>
      </Surface>

      {selectedPatient ? (
        <Surface
          title="Patient lab history"
          description={`${patientName(selectedPatient)} / ${selectedPatient.patientCode}`}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Orders
              </p>
              <p className="mt-1 text-xl font-semibold">
                {patientLabOrders.length}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Pending
              </p>
              <p className="mt-1 text-xl font-semibold">
                {
                  patientLabOrders.filter(
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
                  patientLabOrders.filter(
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
                  {isLoadingPatientLabOrders ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-[#687067]"
                      >
                        Loading patient lab orders...
                      </td>
                    </tr>
                  ) : patientLabOrders.length ? (
                    patientLabOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-t border-[#edf0e9]"
                      >
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
                            onClick={() => openLabOrder(order)}
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
                        No lab history for this patient
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#e3e7df] px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#687067]">
              Page {patientLabPage} of {patientLabPagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setPatientLabPage((current) => Math.max(1, current - 1))
                }
                disabled={patientLabPage <= 1}
                className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPatientLabPage((current) =>
                    Math.min(patientLabPagination.totalPages, current + 1)
                  )
                }
                disabled={patientLabPage >= patientLabPagination.totalPages}
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
