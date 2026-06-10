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

type OpdVisit = {
  id: string;
  visitNo: string;
  appointment?: {
    id: string;
    appointmentNo: string;
    appointmentAt: string;
  } | null;
};

type BillItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
};

type BillPayment = {
  id: string;
  amount: string;
  method: string;
  referenceNo?: string | null;
  notes?: string | null;
  paidAt: string;
};

type Bill = {
  id: string;
  billNo: string;
  billDate: string;
  status: string;
  subtotal: string;
  discount: string;
  tax: string;
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
  notes?: string | null;
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
  items: BillItem[];
  payments: BillPayment[];
};

type BillItemDraft = {
  description: string;
  quantity: string;
  unitPrice: string;
};

type BillForm = {
  notes: string;
  discount: string;
  tax: string;
  paymentAmount: string;
  paymentMethod: string;
  paymentReferenceNo: string;
  paymentNotes: string;
};

const blankBillItem: BillItemDraft = {
  description: "",
  quantity: "1",
  unitPrice: "",
};

const initialBillForm: BillForm = {
  notes: "",
  discount: "",
  tax: "",
  paymentAmount: "",
  paymentMethod: "CASH",
  paymentReferenceNo: "",
  paymentNotes: "",
};

const paymentMethods = [
  "CASH",
  "CARD",
  "UPI",
  "BANK_TRANSFER",
  "INSURANCE",
  "OTHER",
];

const billStatuses = [
  "DRAFT",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
];

function formatMoney(value: string | number | null | undefined) {
  const amount =
    typeof value === "string"
      ? Number(value || 0)
      : Number(value ?? 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function patientName(patient?: Patient | null) {
  if (!patient) {
    return "Not set";
  }

  return [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean)
    .join(" ");
}

type BillingConsoleProps = {
  token: string;
  user: AuthUser;
  effectiveHospitalId: string;
  patients: Patient[];
  selectedPatient: Patient | null;
  activeOpdVisit: OpdVisit | null;
  onOpenPatient: (patient: Patient) => void;
};

export function BillingConsole({
  token,
  user,
  effectiveHospitalId,
  patients,
  selectedPatient,
  activeOpdVisit,
  onOpenPatient,
}: BillingConsoleProps) {
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] =
    useState<Bill | null>(null);
  const [billSearch, setBillSearch] = useState("");
  const [billStatus, setBillStatus] = useState("");
  const [billPage, setBillPage] = useState(1);
  const [billPagination, setBillPagination] =
    useState<Pagination>({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
    });
  const [isLoadingBills, setIsLoadingBills] =
    useState(false);

  const [patientBills, setPatientBills] = useState<
    Bill[]
  >([]);
  const [patientBillPage, setPatientBillPage] =
    useState(1);
  const [patientBillPagination, setPatientBillPagination] =
    useState<Pagination>({
      page: 1,
      limit: 5,
      total: 0,
      totalPages: 1,
    });
  const [
    isLoadingPatientBills,
    setIsLoadingPatientBills,
  ] = useState(false);

  const [billItems, setBillItems] = useState<
    BillItemDraft[]
  >([blankBillItem]);
  const [billForm, setBillForm] =
    useState<BillForm>(initialBillForm);
  const [billPatientId, setBillPatientId] =
    useState("");
  const [billOpdVisitId, setBillOpdVisitId] =
    useState("");
  const [isSavingBill, setIsSavingBill] =
    useState(false);
  const [billMessage, setBillMessage] =
    useState("");
  const [billError, setBillError] = useState("");

  const [paymentDraft, setPaymentDraft] =
    useState({
      amount: "",
      method: "CASH",
      referenceNo: "",
      notes: "",
    });
  const [isSavingPayment, setIsSavingPayment] =
    useState(false);
  const [paymentMessage, setPaymentMessage] =
    useState("");
  const [paymentError, setPaymentError] =
    useState("");

  const patientOptions = useMemo(() => {
    const options = [...patients];

    if (
      selectedPatient &&
      !options.some(
        (patient) => patient.id === selectedPatient.id
      )
    ) {
      options.unshift(selectedPatient);
    }

    return options;
  }, [patients, selectedPatient]);

  const visibleSummary = useMemo(() => {
    const billBalance = allBills.reduce(
      (sum, bill) => sum + Number(bill.balanceAmount || 0),
      0
    );

    return {
      total: allBills.length,
      unpaid: allBills.filter((bill) =>
        ["DRAFT", "UNPAID"].includes(bill.status)
      ).length,
      partial: allBills.filter(
        (bill) => bill.status === "PARTIALLY_PAID"
      ).length,
      paid: allBills.filter((bill) => bill.status === "PAID").length,
      balance: billBalance,
    };
  }, [allBills]);

  const patientSummary = useMemo(() => {
    const billBalance = patientBills.reduce(
      (sum, bill) => sum + Number(bill.balanceAmount || 0),
      0
    );

    return {
      total: patientBills.length,
      paid: patientBills.filter((bill) => bill.status === "PAID").length,
      balance: billBalance,
    };
  }, [patientBills]);

  const fetchBills = useCallback(async () => {
      if (!token || !user || !effectiveHospitalId) {
        setAllBills([]);
        return;
      }

      setIsLoadingBills(true);

      const params = new URLSearchParams({
        page: String(billPage),
        limit: "10",
      });

      if (billSearch) {
        params.set("search", billSearch);
      }

      if (billStatus) {
        params.set("status", billStatus);
      }

      if (user.userType === "SUPER_ADMIN") {
        params.set("hospitalId", effectiveHospitalId);
      }

      try {
        const response = await fetch(
          `/api/bills?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const result = (await response.json()) as
          | ApiSuccess<{
              bills: Bill[];
              pagination: Pagination;
            }>
          | ApiFailure;

        if (result.success) {
          setAllBills(result.data.bills);
          setBillPagination({
            ...result.data.pagination,
            totalPages: Math.max(
              result.data.pagination.totalPages,
              1
            ),
          });
        }
      } catch {
        setAllBills([]);
      } finally {
        setIsLoadingBills(false);
      }
    }, [
      billPage,
      billSearch,
      billStatus,
      effectiveHospitalId,
      token,
      user,
    ]);

  const fetchPatientBills = useCallback(async () => {
      if (
        !token ||
        !user ||
        !effectiveHospitalId ||
        !selectedPatient
      ) {
        setPatientBills([]);
        setPatientBillPagination((current) => ({
          ...current,
          total: 0,
          totalPages: 1,
        }));
        return;
      }

      setIsLoadingPatientBills(true);

      const params = new URLSearchParams({
        patientId: selectedPatient.id,
        page: String(patientBillPage),
        limit: "5",
      });

      if (user.userType === "SUPER_ADMIN") {
        params.set("hospitalId", effectiveHospitalId);
      }

      try {
        const response = await fetch(
          `/api/bills?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const result = (await response.json()) as
          | ApiSuccess<{
              bills: Bill[];
              pagination: Pagination;
            }>
          | ApiFailure;

        if (result.success) {
          setPatientBills(result.data.bills);
          setPatientBillPagination({
            ...result.data.pagination,
            totalPages: Math.max(
              result.data.pagination.totalPages,
              1
            ),
          });
        }
      } catch {
        setPatientBills([]);
      } finally {
        setIsLoadingPatientBills(false);
      }
    }, [
      effectiveHospitalId,
      patientBillPage,
      selectedPatient,
      token,
      user,
    ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchBills();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchBills]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchPatientBills();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchPatientBills]);

  function clearBillFilters() {
    setBillSearch("");
    setBillStatus("");
    setBillPage(1);
  }

  function addBillItemRow() {
    setBillItems((current) => [...current, { ...blankBillItem }]);
  }

  function updateBillItemRow(
    index: number,
    field: keyof BillItemDraft,
    value: string
  ) {
    setBillItems((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  function removeBillItemRow(index: number) {
    setBillItems((current) => {
      if (current.length === 1) {
        return [{ ...blankBillItem }];
      }

      return current.filter(
        (_, rowIndex) => rowIndex !== index
      );
    });
  }

  function resetBillForm() {
    setBillItems([{ ...blankBillItem }]);
    setBillForm(initialBillForm);
    setBillPatientId(selectedPatient?.id ?? "");
    setBillOpdVisitId(activeOpdVisit?.id ?? "");
  }

  function openBill(bill: Bill) {
    setSelectedBill(bill);
    setPaymentDraft({
      amount: bill.balanceAmount,
      method: "CASH",
      referenceNo: "",
      notes: "",
    });
    setPaymentError("");
    setPaymentMessage("");
  }

  async function saveBill(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const targetPatientId =
      billPatientId || selectedPatient?.id || "";
    const targetOpdVisitId =
      billOpdVisitId || activeOpdVisit?.id || "";

    if (!targetPatientId) {
      setBillError("Select a patient first");
      return;
    }

    setIsSavingBill(true);
    setBillError("");
    setBillMessage("");

    const items = billItems
      .map((row) => ({
        description: row.description.trim(),
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
      }))
      .filter((row) => row.description);

    try {
      const response = await fetch("/api/bills", {
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
          opdVisitId: targetOpdVisitId || undefined,
          notes: billForm.notes || undefined,
          discount: billForm.discount
            ? Number(billForm.discount)
            : undefined,
          tax: billForm.tax
            ? Number(billForm.tax)
            : undefined,
          paymentAmount: billForm.paymentAmount
            ? Number(billForm.paymentAmount)
            : undefined,
          paymentMethod: billForm.paymentAmount
            ? billForm.paymentMethod
            : undefined,
          paymentReferenceNo:
            billForm.paymentReferenceNo || undefined,
          paymentNotes:
            billForm.paymentNotes || undefined,
          items,
        }),
      });
      const result = (await response.json()) as
        | ApiSuccess<Bill>
        | ApiFailure;

      if (!result.success) {
        setBillError(result.message);
        return;
      }

      setBillMessage(`${result.data.billNo} created`);
      setSelectedBill(result.data);
      resetBillForm();
      await fetchBills();
      await fetchPatientBills();
    } catch {
      setBillError("Unable to save bill");
    } finally {
      setIsSavingBill(false);
    }
  }

  async function recordPayment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedBill) {
      return;
    }

    const amount = Number(paymentDraft.amount || 0);

    if (amount <= 0) {
      setPaymentError("Enter a payment amount");
      return;
    }

    setIsSavingPayment(true);
    setPaymentError("");
    setPaymentMessage("");

    try {
      const response = await fetch(
        `/api/bills/${selectedBill.id}${
          user.userType === "SUPER_ADMIN"
            ? `?hospitalId=${effectiveHospitalId}`
            : ""
        }`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentAmount: amount,
            paymentMethod: paymentDraft.method,
            paymentReferenceNo:
              paymentDraft.referenceNo || undefined,
            paymentNotes: paymentDraft.notes || undefined,
          }),
        }
      );
      const result = (await response.json()) as
        | ApiSuccess<Bill>
        | ApiFailure;

      if (!result.success) {
        setPaymentError(result.message);
        return;
      }

      setPaymentMessage("Payment recorded");
      setSelectedBill(result.data);
      setPaymentDraft({
        amount: result.data.balanceAmount,
        method: "CASH",
        referenceNo: "",
        notes: "",
      });
      await fetchBills();
      await fetchPatientBills();
    } catch {
      setPaymentError("Unable to record payment");
    } finally {
      setIsSavingPayment(false);
    }
  }

  function printBill() {
    window.print();
  }

  return (
    <div className="grid gap-5">
      <Surface
        title="Billing desk"
        description="Hospital-wide bill registry, payment capture, and receipt handling"
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
              onClick={clearBillFilters}
              className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Clear filters
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Bills
            </p>
            <p className="mt-1 text-xl font-semibold">
              {visibleSummary.total}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Unpaid
            </p>
            <p className="mt-1 text-xl font-semibold">
              {visibleSummary.unpaid}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Partially paid
            </p>
            <p className="mt-1 text-xl font-semibold">
              {visibleSummary.partial}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Paid
            </p>
            <p className="mt-1 text-xl font-semibold">
              {visibleSummary.paid}
            </p>
          </div>
          <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
              Balance visible
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatMoney(visibleSummary.balance)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.5fr_0.9fr_0.8fr]">
          <label className="text-sm font-medium">
            Search bills
            <input
              value={billSearch}
              onChange={(event) => {
                setBillSearch(event.target.value);
                setBillPage(1);
              }}
              className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              placeholder="Bill no, notes"
            />
          </label>

          <label className="text-sm font-medium">
            Status
            <select
              value={billStatus}
              onChange={(event) => {
                setBillStatus(event.target.value);
                setBillPage(1);
              }}
              className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
            >
              <option value="">All statuses</option>
              {billStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setBillPage(1)}
              className="h-10 w-full rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Refresh list
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-md border border-[#e3e7df]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-[#f3f5f0] text-xs uppercase tracking-[0.08em] text-[#687067]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Bill</th>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">OPD</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Paid</th>
                  <th className="px-4 py-3 font-semibold">Balance</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingBills ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-sm text-[#687067]"
                    >
                      Loading bills...
                    </td>
                  </tr>
                ) : allBills.length ? (
                  allBills.map((bill) => (
                    <tr
                      key={bill.id}
                      className="border-t border-[#edf0e9]"
                    >
                      <td className="px-4 py-3 font-medium">
                        <div>{bill.billNo}</div>
                        <div className="mt-1 text-xs text-[#687067]">
                          {formatDateTime(bill.billDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {patientName(bill.patient)}
                      </td>
                      <td className="px-4 py-3">
                        {bill.opdVisit?.visitNo ?? "Not linked"}
                      </td>
                      <td className="px-4 py-3">
                        {formatMoney(bill.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {formatMoney(bill.paidAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {formatMoney(bill.balanceAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {formatLabel(bill.status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openBill(bill)}
                            className="h-8 rounded-md border border-[#cfd6ca] px-3 text-xs font-medium hover:bg-[#f1f3ee]"
                          >
                            Open
                          </button>
                          {bill.patient ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenPatient(bill.patient!)
                              }
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
                      colSpan={8}
                      className="px-4 py-8 text-center text-sm text-[#687067]"
                    >
                      No bills found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e3e7df] px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#687067]">
            Page {billPage} of {billPagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setBillPage((current) =>
                  Math.max(1, current - 1)
                )
              }
              disabled={billPage <= 1}
              className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setBillPage((current) =>
                  Math.min(
                    billPagination.totalPages,
                    current + 1
                  )
                )
              }
              disabled={billPage >= billPagination.totalPages}
              className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </Surface>

      {selectedBill ? (
        <Surface
          printSection="bill-summary"
          title="Bill summary"
          description={`${selectedBill.billNo} / ${formatDateTime(selectedBill.billDate)}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={printBill}
                className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedBill(null)
                }
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
                Total
              </p>
              <p className="mt-1 font-semibold">
                {formatMoney(selectedBill.totalAmount)}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Paid
              </p>
              <p className="mt-1 font-semibold">
                {formatMoney(selectedBill.paidAmount)}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Balance
              </p>
              <p className="mt-1 font-semibold">
                {formatMoney(selectedBill.balanceAmount)}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Status
              </p>
              <p className="mt-1 font-semibold">
                {formatLabel(selectedBill.status)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Patient
              </p>
              <p className="font-medium">
                {patientName(selectedBill.patient)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                OPD visit
              </p>
              <p className="font-medium">
                {selectedBill.opdVisit?.visitNo ?? "Not linked"}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-[#e3e7df]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f3f5f0] text-xs uppercase tracking-[0.08em] text-[#687067]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 font-semibold">Qty</th>
                  <th className="px-3 py-2 font-semibold">Unit</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedBill.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#edf0e9]"
                  >
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2">{item.quantity}</td>
                    <td className="px-3 py-2">{formatMoney(item.unitPrice)}</td>
                    <td className="px-3 py-2">{formatMoney(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 rounded-md border border-[#e3e7df] bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-semibold">Payment history</h4>
                <p className="text-sm text-[#687067]">
                  Recorded payments against this bill
                </p>
              </div>
            </div>

            {selectedBill.payments.length ? (
              <div className="overflow-hidden rounded-md border border-[#e3e7df]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[#f3f5f0] text-xs uppercase tracking-[0.08em] text-[#687067]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">
                        Amount
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        Method
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        Reference
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        Paid at
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-t border-[#edf0e9]"
                      >
                        <td className="px-3 py-2 font-medium">
                          {formatMoney(payment.amount)}
                        </td>
                        <td className="px-3 py-2">
                          {formatLabel(payment.method)}
                        </td>
                        <td className="px-3 py-2">
                          {payment.referenceNo ?? "NA"}
                        </td>
                        <td className="px-3 py-2">
                          {formatDateTime(payment.paidAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[#687067]">
                No payments recorded yet
              </p>
            )}
          </div>

          <form
            onSubmit={recordPayment}
            className="mt-4 grid gap-3 rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-4"
          >
            <div className="flex flex-col gap-1">
              <h4 className="font-semibold">
                Record payment
              </h4>
              <p className="text-sm text-[#687067]">
                Add a partial payment, collection, or settlement
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium">
                Amount
                <input
                  value={paymentDraft.amount}
                  onChange={(event) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      amount: event.target.value,
                    })
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                />
              </label>

              <label className="text-sm font-medium">
                Method
                <select
                  value={paymentDraft.method}
                  onChange={(event) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      method: event.target.value,
                    })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {formatLabel(method)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Reference no.
                <input
                  value={paymentDraft.referenceNo}
                  onChange={(event) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      referenceNo: event.target.value,
                    })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                />
              </label>

              <label className="text-sm font-medium">
                Payment notes
                <input
                  value={paymentDraft.notes}
                  onChange={(event) =>
                    setPaymentDraft({
                      ...paymentDraft,
                      notes: event.target.value,
                    })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                />
              </label>
            </div>

            {paymentMessage ? (
              <p className="rounded-md bg-[#eef8f1] px-3 py-2 text-sm text-[#27603a]">
                {paymentMessage}
              </p>
            ) : null}

            {paymentError ? (
              <p className="rounded-md bg-[#fff0ef] px-3 py-2 text-sm text-[#9f2d24]">
                {paymentError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSavingPayment}
                className="h-11 rounded-md bg-[#2f5d50] px-4 text-sm font-semibold text-white transition hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingPayment ? "Recording payment" : "Save payment"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPaymentDraft({
                    amount: selectedBill.balanceAmount,
                    method: "CASH",
                    referenceNo: "",
                    notes: "",
                  })
                }
                className="h-11 rounded-md border border-[#cfd6ca] px-4 text-sm font-medium hover:bg-[#f1f3ee]"
              >
                Reset payment
              </button>
            </div>
          </form>
        </Surface>
      ) : null}

      <Surface
        title="Create bill"
        description="Use the currently open patient or choose another patient from the quick selector"
      >
        <form onSubmit={saveBill} className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
            <label className="text-sm font-medium">
              Patient
              <select
                value={billPatientId || selectedPatient?.id || ""}
                onChange={(event) =>
                  setBillPatientId(event.target.value)
                }
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
                value={billOpdVisitId || activeOpdVisit?.id || ""}
                onChange={(event) =>
                  setBillOpdVisitId(event.target.value)
                }
                placeholder={activeOpdVisit?.visitNo ?? "Optional"}
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              />
            </label>

            <div className="flex flex-wrap items-end gap-2">
              {selectedPatient ? (
                <button
                  type="button"
                  onClick={() => {
                    setBillPatientId(selectedPatient.id);
                    if (activeOpdVisit?.id) {
                      setBillOpdVisitId(activeOpdVisit.id);
                    }
                  }}
                  className="h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
                >
                  Use current patient
                </button>
              ) : null}
              {activeOpdVisit ? (
                <button
                  type="button"
                  onClick={() =>
                    setBillOpdVisitId(activeOpdVisit.id)
                  }
                  className="h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
                >
                  Use current OPD
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3">
            {billItems.map((row, index) => (
              <div
                key={`${index}-${row.description}`}
                className="grid gap-3 rounded-md border border-[#e3e7df] p-3 lg:grid-cols-[1.8fr_0.7fr_0.9fr_auto]"
              >
                <label className="text-sm font-medium">
                  Description
                  <input
                    value={row.description}
                    onChange={(event) =>
                      updateBillItemRow(
                        index,
                        "description",
                        event.target.value
                      )
                    }
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                    placeholder="Consultation fee"
                    required
                  />
                </label>

                <label className="text-sm font-medium">
                  Quantity
                  <input
                    value={row.quantity}
                    onChange={(event) =>
                      updateBillItemRow(
                        index,
                        "quantity",
                        event.target.value
                      )
                    }
                    type="number"
                    min="1"
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                  />
                </label>

                <label className="text-sm font-medium">
                  Unit price
                  <input
                    value={row.unitPrice}
                    onChange={(event) =>
                      updateBillItemRow(
                        index,
                        "unitPrice",
                        event.target.value
                      )
                    }
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeBillItemRow(index)}
                    className="h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addBillItemRow}
              className="h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Add item
            </button>
            <button
              type="button"
              onClick={resetBillForm}
              className="h-10 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee]"
            >
              Reset
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Discount
              <input
                value={billForm.discount}
                onChange={(event) =>
                  setBillForm({
                    ...billForm,
                    discount: event.target.value,
                  })
                }
                type="number"
                min="0"
                step="0.01"
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              />
            </label>

            <label className="text-sm font-medium">
              Tax
              <input
                value={billForm.tax}
                onChange={(event) =>
                  setBillForm({
                    ...billForm,
                    tax: event.target.value,
                  })
                }
                type="number"
                min="0"
                step="0.01"
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              />
            </label>

            <label className="text-sm font-medium">
              First payment
              <input
                value={billForm.paymentAmount}
                onChange={(event) =>
                  setBillForm({
                    ...billForm,
                    paymentAmount: event.target.value,
                  })
                }
                type="number"
                min="0"
                step="0.01"
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Payment method
              <select
                value={billForm.paymentMethod}
                onChange={(event) =>
                  setBillForm({
                    ...billForm,
                    paymentMethod: event.target.value,
                  })
                }
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] bg-white px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {formatLabel(method)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Reference no.
              <input
                value={billForm.paymentReferenceNo}
                onChange={(event) =>
                  setBillForm({
                    ...billForm,
                    paymentReferenceNo: event.target.value,
                  })
                }
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              />
            </label>

            <label className="text-sm font-medium">
              Payment notes
              <input
                value={billForm.paymentNotes}
                onChange={(event) =>
                  setBillForm({
                    ...billForm,
                    paymentNotes: event.target.value,
                  })
                }
                className="mt-2 h-10 w-full rounded-md border border-[#cfd6ca] px-3 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
              />
            </label>
          </div>

          <label className="text-sm font-medium">
            Bill notes
            <textarea
              value={billForm.notes}
              onChange={(event) =>
                setBillForm({
                  ...billForm,
                  notes: event.target.value,
                })
              }
              className="mt-2 min-h-20 w-full rounded-md border border-[#cfd6ca] px-3 py-2 outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
            />
          </label>

          <div className="grid gap-3 rounded-md border border-[#e3e7df] bg-[#f8faf6] p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Items
              </p>
              <p className="font-medium">{billItems.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Subtotal
              </p>
              <p className="font-medium">
                {formatMoney(
                  billItems.reduce(
                    (sum, row) =>
                      sum +
                      Number(row.quantity || 0) *
                        Number(row.unitPrice || 0),
                    0
                  )
                )}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Discount + Tax
              </p>
              <p className="font-medium">
                {formatMoney(
                  Number(billForm.tax || 0) +
                    Number(billForm.discount || 0)
                )}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                First payment
              </p>
              <p className="font-medium">
                {formatMoney(billForm.paymentAmount)}
              </p>
            </div>
          </div>

          {billMessage ? (
            <p className="rounded-md bg-[#eef8f1] px-3 py-2 text-sm text-[#27603a]">
              {billMessage}
            </p>
          ) : null}

          {billError ? (
            <p className="rounded-md bg-[#fff0ef] px-3 py-2 text-sm text-[#9f2d24]">
              {billError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={
                isSavingBill ||
                !billPatientId ||
                billItems.length === 0 ||
                billItems.every(
                  (row) => !row.description.trim()
                )
              }
              className="h-11 rounded-md bg-[#2f5d50] px-4 text-sm font-semibold text-white transition hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingBill ? "Saving bill" : "Create bill"}
            </button>
          </div>
        </form>
      </Surface>

      {selectedPatient ? (
        <Surface
          title="Current patient billing history"
          description={`${patientName(selectedPatient)} / ${selectedPatient.patientCode}`}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Bills
              </p>
              <p className="mt-1 text-xl font-semibold">
                {patientSummary.total}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Paid
              </p>
              <p className="mt-1 text-xl font-semibold">
                {patientSummary.paid}
              </p>
            </div>
            <div className="rounded-md border border-[#e3e7df] bg-[#fbfcfa] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#687067]">
                Balance
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatMoney(patientSummary.balance)}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-[#e3e7df]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-[#f3f5f0] text-xs uppercase tracking-[0.08em] text-[#687067]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Bill</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Paid</th>
                    <th className="px-4 py-3 font-semibold">Balance</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingPatientBills ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-sm text-[#687067]"
                      >
                        Loading patient bills...
                      </td>
                    </tr>
                  ) : patientBills.length ? (
                    patientBills.map((bill) => (
                      <tr
                        key={bill.id}
                        className="border-t border-[#edf0e9]"
                      >
                        <td className="px-4 py-3 font-medium">
                          {bill.billNo}
                        </td>
                        <td className="px-4 py-3">
                          {formatDateTime(bill.billDate)}
                        </td>
                        <td className="px-4 py-3">
                          {formatMoney(bill.totalAmount)}
                        </td>
                        <td className="px-4 py-3">
                          {formatMoney(bill.paidAmount)}
                        </td>
                        <td className="px-4 py-3">
                          {formatMoney(bill.balanceAmount)}
                        </td>
                        <td className="px-4 py-3">
                          {formatLabel(bill.status)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openBill(bill)}
                            className="h-8 rounded-md border border-[#cfd6ca] px-3 text-xs font-medium hover:bg-[#f1f3ee]"
                          >
                            Open bill
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-sm text-[#687067]"
                      >
                        No billing history for this patient
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#e3e7df] px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#687067]">
              Page {patientBillPage} of {patientBillPagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setPatientBillPage((current) =>
                    Math.max(1, current - 1)
                  )
                }
                disabled={patientBillPage <= 1}
                className="h-9 rounded-md border border-[#cfd6ca] px-3 text-sm font-medium hover:bg-[#f1f3ee] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPatientBillPage((current) =>
                    Math.min(
                      patientBillPagination.totalPages,
                      current + 1
                    )
                  )
                }
                disabled={
                  patientBillPage >= patientBillPagination.totalPages
                }
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
