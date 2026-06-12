"use client";

import { useState, useEffect, useCallback, FormEvent, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Surface } from "@/components/ui/surface";
import { BillingConsole } from "@/components/billing-console";
import { LabConsole } from "@/components/lab-console";
import { RadiologyConsole } from "@/components/radiology-console";
import { getCachedData, setCachedData } from "@/lib/client-cache";

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
  country?: string | null;
  pincode?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  emergencyRelation?: string | null;
  allergies?: string | null;
  remarks?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string;
  department?: string | null;
};

type Appointment = {
  id: string;
  appointmentNo: string;
  appointmentAt: string;
  status: string;
  notes?: string | null;
  patient: Patient;
  doctor?: Employee | null;
};

type Vital = {
  temperature?: string | null;
  pulse?: number | null;
  respiratoryRate?: number | null;
  bloodPressure?: string | null;
  oxygenSaturation?: number | null;
  height?: string | null;
  weight?: string | null;
  bmi?: string | null;
};

type PrescriptionItem = {
  id?: string;
  medicineName: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
};

type PrescriptionDraft = {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type OpdVisit = {
  id: string;
  visitNo: string;
  createdAt?: string;
  chiefComplaint?: string | null;
  diagnosis?: string | null;
  clinicalNotes?: string | null;
  treatmentPlan?: string | null;
  status: string;
  patient?: Patient;
  appointment?: {
    id: string;
    appointmentNo: string;
    appointmentAt: string;
    doctor?: Employee | null;
  } | null;
  vitals?: Vital | null;
  prescription?: {
    notes?: string | null;
    items: PrescriptionItem[];
  } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const initialPatientForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "MALE",
  dateOfBirth: "",
  phone: "",
  email: "",
  bloodGroup: "",
  maritalStatus: "SINGLE",
  aadhaarNumber: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelation: "",
  allergies: "",
  remarks: "",
};

const initialAppointmentForm = {
  patientId: "",
  doctorId: "",
  appointmentAt: "",
  status: "SCHEDULED",
  notes: "",
};

const initialOpdForm = {
  chiefComplaint: "",
  diagnosis: "",
  clinicalNotes: "",
  treatmentPlan: "",
  status: "OPEN",
  temperature: "",
  pulse: "",
  respiratoryRate: "",
  bloodPressure: "",
  oxygenSaturation: "",
  height: "",
  weight: "",
  bmi: "",
  prescriptionNotes: "",
};

const blankPrescriptionRow: PrescriptionDraft = {
  medicineName: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

export default function EmployeePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<any>(null);
  const [hospitalId, setHospitalId] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalLogo, setHospitalLogo] = useState("");

  // Role detection
  const [role, setRole] = useState<"receptionist" | "doctor" | "accountant" | "lab_technician" | "unknown">("unknown");

  // Enabled modules for conditional rendering
  const [enabledModules, setEnabledModules] = useState<string[]>([]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, patients, appointments, billing, lab, radiology
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Common operational state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientPage, setPatientPage] = useState(1);
  const [patientPagination, setPatientPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const doctorsList = useMemo(() => {
    return employeesList.filter((emp) =>
      emp.designation?.toLowerCase().includes("doctor")
    );
  }, [employeesList]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("");
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [appointmentPagination, setAppointmentPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState("");
  const [debouncedAppointmentSearch, setDebouncedAppointmentSearch] = useState("");

  // Receptionist Forms state
  const [patientForm, setPatientForm] = useState(initialPatientForm);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [patientMsg, setPatientMsg] = useState("");
  const [patientErr, setPatientErr] = useState("");
  const [lastRegisteredPatient, setLastRegisteredPatient] = useState<Patient | null>(null);

  const [appointmentForm, setAppointmentForm] = useState(initialAppointmentForm);
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [appointmentMsg, setAppointmentMsg] = useState("");
  const [appointmentErr, setAppointmentErr] = useState("");

  // Appointment editing state
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editApptForm, setEditApptForm] = useState({ doctorId: "", appointmentAt: "", status: "", notes: "" });
  const [isSavingEditAppt, setIsSavingEditAppt] = useState(false);
  const [editApptMsg, setEditApptMsg] = useState("");
  const [editApptErr, setEditApptErr] = useState("");

  // Unified Check-In States
  const [checkInDoctorId, setCheckInDoctorId] = useState("");
  const [checkInNotes, setCheckInNotes] = useState("");
  const [checkInImmediately, setCheckInImmediately] = useState(true);
  const [checkInVitals, setCheckInVitals] = useState({
    temperature: "",
    pulse: "",
    respiratoryRate: "",
    bloodPressure: "",
    oxygenSaturation: "",
    height: "",
    weight: "",
    bmi: "",
  });
  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState("");
  const [checkInErr, setCheckInErr] = useState("");

  // Doctor Forms state
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [isLoadingToday, setIsLoadingToday] = useState(false);
  const [activeOpdVisit, setActiveOpdVisit] = useState<OpdVisit | null>(null);
  // Reports operational logs state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [logsPage, setLogsPage] = useState(1);
  const [reportsSubTab, setReportsSubTab] = useState<"patients" | "opd" | "ipd">("patients");
  const [opdForm, setOpdForm] = useState(initialOpdForm);
  const [prescriptionRows, setPrescriptionRows] = useState<PrescriptionDraft[]>([blankPrescriptionRow]);
  const [isSavingOpd, setIsSavingOpd] = useState(false);
  const [opdMsg, setOpdMsg] = useState("");
  const [opdErr, setOpdErr] = useState("");
  const [opdHistory, setOpdHistory] = useState<OpdVisit[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Auth Guard & Role resolver
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

      // Resolve roles
      const isDoctor = parsedUser.roles?.some((r: any) => r.name.toLowerCase() === "doctor") ||
                       parsedUser.employee?.designation?.toLowerCase().includes("doctor");
      const isReceptionist = parsedUser.roles?.some((r: any) => r.name.toLowerCase() === "receptionist") ||
                             parsedUser.employee?.designation?.toLowerCase().includes("receptionist");
      const isAccountant = parsedUser.roles?.some((r: any) => r.name.toLowerCase() === "accountant") ||
                           parsedUser.employee?.designation?.toLowerCase().includes("accountant");
      const isLab = parsedUser.roles?.some((r: any) => r.name.toLowerCase() === "lab technician" || r.name.toLowerCase() === "pathologist") ||
                    parsedUser.employee?.designation?.toLowerCase().includes("lab") ||
                    parsedUser.employee?.designation?.toLowerCase().includes("technician");

      if (isDoctor) {
        setRole("doctor");
      } else if (isReceptionist) {
        setRole("receptionist");
      } else if (isAccountant) {
        setRole("accountant");
        setActiveTab("billing"); // Set billing tab by default
      } else if (isLab) {
        setRole("lab_technician");
        setActiveTab("lab"); // Set lab tab by default
      } else {
        setRole("receptionist"); // default fallback
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  // Load modules enabled for hospital
  useEffect(() => {
    if (!token || !hospitalId) return;

    const cacheKey = `hospital_modules_${hospitalId}`;
    const cachedModules = getCachedData<string[]>(cacheKey);
    if (cachedModules) {
      setEnabledModules(cachedModules);
    } else {
      fetch(`/api/hospitals/${hospitalId}/modules`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const list = data.data.filter((item: any) => item.enabled).map((item: any) => item.module.code);
            setEnabledModules(list);
            setCachedData(cacheKey, list);
          }
        });
    }
  }, [token, hospitalId]);

  // Load hospital info
  useEffect(() => {
    if (!token || !hospitalId) return;

    const cacheKey = `hospital_details_${hospitalId}`;
    const cachedHosp = getCachedData<any>(cacheKey);
    if (cachedHosp) {
      setHospitalName(cachedHosp.name);
      setHospitalLogo(cachedHosp.logo || "");
    } else {
      fetch(`/api/hospitals/${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setHospitalName(data.data.name);
            setHospitalLogo(data.data.logo || "");
            setCachedData(cacheKey, data.data);
          }
        });
    }
  }, [token, hospitalId]);

  // Debouncing logic for patient search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPatientSearch(patientSearch);
    }, 400);
    return () => clearTimeout(handler);
  }, [patientSearch]);

  // Debouncing logic for appointment search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedAppointmentSearch(appointmentSearch);
    }, 400);
    return () => clearTimeout(handler);
  }, [appointmentSearch]);

  // Fetch Patients List
  const fetchPatients = useCallback(async () => {
    if (!token || !hospitalId) return;
    setIsLoadingPatients(true);
    try {
      const params = new URLSearchParams({
        page: String(patientPage),
        limit: "10",
        search: debouncedPatientSearch,
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
  }, [token, hospitalId, patientPage, debouncedPatientSearch]);

  // Fetch employees list
  const fetchEmployees = useCallback(async () => {
    if (!token || !hospitalId) return;
    const cacheKey = `employees_lookup_${hospitalId}`;
    const cached = getCachedData<Employee[]>(cacheKey);
    if (cached) {
      setEmployeesList(cached);
      return;
    }
    try {
      const res = await fetch(`/api/employees?hospitalId=${hospitalId}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setEmployeesList(data.data.employees);
        setCachedData(cacheKey, data.data.employees);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token, hospitalId]);

  // Fetch Appointments
  const fetchAppointments = useCallback(async () => {
    if (!token || !hospitalId) return;
    setIsLoadingAppointments(true);
    try {
      const params = new URLSearchParams({
        page: String(appointmentPage),
        limit: "10",
        search: debouncedAppointmentSearch,
        status: appointmentStatus,
        hospitalId,
      });
      const res = await fetch(`/api/appointments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAppointments(data.data.appointments);
        setAppointmentPagination(data.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [token, hospitalId, appointmentPage, debouncedAppointmentSearch, appointmentStatus]);

  // Fetch Doctor's Today Queue
  const fetchTodayQueue = useCallback(async () => {
    if (!token || !hospitalId) return;
    setIsLoadingToday(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        from: today.toISOString(),
        to: tomorrow.toISOString(),
        hospitalId,
      });
      const res = await fetch(`/api/appointments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        // If doctor, filter queue only for this logged in doctor
        const loggedInDoctorName = user?.employee?.fullName?.toLowerCase() || "";
        const queue = data.data.appointments.filter((a: any) => {
          if (role === "doctor" && a.doctor) {
            return a.doctor.fullName.toLowerCase().includes(loggedInDoctorName);
          }
          return true;
        });
        setTodayAppointments(queue);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingToday(false);
    }
  }, [token, hospitalId, role, user]);

  // Fetch patient medical visit history
  const fetchPatientOpdHistory = useCallback(async (pId: string) => {
    if (!token || !hospitalId) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/opd-visits?patientId=${pId}&hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOpdHistory(data.data.visits);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token, hospitalId]);

  // Fetch activity logs for Reports tab
  const fetchLogs = useCallback(async () => {
    if (!token || !hospitalId) return;
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/activity-logs?hospitalId=${hospitalId}&page=${logsPage}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setActivityLogs(data.data.activityLogs);
        setLogsPagination(data.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [token, hospitalId, logsPage]);

  // Load screen data dynamically
  useEffect(() => {
    if (token && hospitalId) {
      if (activeTab === "patients") { fetchPatients(); fetchEmployees(); }
      if (activeTab === "appointments") {
        fetchAppointments();
        fetchEmployees();
      }
      if (activeTab === "dashboard") {
        fetchTodayQueue();
        fetchPatients();
        fetchEmployees();
      }
      if (activeTab === "reports") {
        fetchLogs();
      }
    }
  }, [activeTab, token, hospitalId, fetchPatients, fetchAppointments, fetchEmployees, fetchTodayQueue, fetchLogs]);

  // Register Patient Form Handler (with optional Immediate Check-In)
  const handleRegisterPatient = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !hospitalId) return;

    setIsSavingPatient(true);
    setPatientMsg("");
    setPatientErr("");

    const payload = {
      ...patientForm,
      dateOfBirth: patientForm.dateOfBirth ? new Date(patientForm.dateOfBirth).toISOString() : undefined,
      hospitalId,
    };

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setPatientErr(data.message);
        setIsSavingPatient(false);
        return;
      }

      const newPatient = data.data;
      setLastRegisteredPatient(newPatient);

      if (checkInImmediately) {
        // Sequentially call appointment check-in
        const checkInPayload = {
          patientId: newPatient.id,
          doctorId: checkInDoctorId || undefined,
          appointmentAt: new Date().toISOString(),
          status: "CHECKED_IN",
          notes: checkInNotes || "Initial check-in",
          hospitalId,
          vitals: {
            temperature: checkInVitals.temperature || null,
            pulse: checkInVitals.pulse ? Number(checkInVitals.pulse) : null,
            respiratoryRate: checkInVitals.respiratoryRate ? Number(checkInVitals.respiratoryRate) : null,
            bloodPressure: checkInVitals.bloodPressure || null,
            oxygenSaturation: checkInVitals.oxygenSaturation ? Number(checkInVitals.oxygenSaturation) : null,
            height: checkInVitals.height || null,
            weight: checkInVitals.weight || null,
            bmi: checkInVitals.bmi || null,
          },
        };

        const checkInRes = await fetch("/api/appointments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(checkInPayload),
        });
        const checkInData = await checkInRes.json();

        if (!checkInData.success) {
          setPatientMsg(`Patient registered successfully (Code: ${newPatient.patientCode}), but vitals check-in failed: ${checkInData.message}`);
        } else {
          setPatientMsg(`Patient registered and checked in successfully! Patient Code: ${newPatient.patientCode}, Appointment: ${checkInData.data.appointmentNo}`);
        }
      } else {
        setPatientMsg(`Patient registered successfully! Generated Code: ${newPatient.patientCode}`);
      }

      // Reset forms
      setPatientForm(initialPatientForm);
      setCheckInDoctorId("");
      setCheckInNotes("");
      setCheckInVitals({
        temperature: "",
        pulse: "",
        respiratoryRate: "",
        bloodPressure: "",
        oxygenSaturation: "",
        height: "",
        weight: "",
        bmi: "",
      });
      fetchPatients();
      fetchTodayQueue();
    } catch (err) {
      console.error(err);
      setPatientErr("Connection error. Please try again.");
    } finally {
      setIsSavingPatient(false);
    }
  };

  // Existing Patient Check-In Handler
  const handleExistingPatientCheckIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !hospitalId || !selectedPatient) return;

    setIsSavingCheckIn(true);
    setCheckInMsg("");
    setCheckInErr("");

    const payload = {
      patientId: selectedPatient.id,
      doctorId: checkInDoctorId || undefined,
      appointmentAt: new Date().toISOString(),
      status: "CHECKED_IN",
      notes: checkInNotes || "Check-In Vitals",
      hospitalId,
      vitals: {
        temperature: checkInVitals.temperature || null,
        pulse: checkInVitals.pulse ? Number(checkInVitals.pulse) : null,
        respiratoryRate: checkInVitals.respiratoryRate ? Number(checkInVitals.respiratoryRate) : null,
        bloodPressure: checkInVitals.bloodPressure || null,
        oxygenSaturation: checkInVitals.oxygenSaturation ? Number(checkInVitals.oxygenSaturation) : null,
        height: checkInVitals.height || null,
        weight: checkInVitals.weight || null,
        bmi: checkInVitals.bmi || null,
      },
    };

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setCheckInErr(data.message);
      } else {
        setCheckInMsg(`Patient checked in successfully! Appointment: ${data.data.appointmentNo}`);
        setCheckInDoctorId("");
        setCheckInNotes("");
        setCheckInVitals({
          temperature: "",
          pulse: "",
          respiratoryRate: "",
          bloodPressure: "",
          oxygenSaturation: "",
          height: "",
          weight: "",
          bmi: "",
        });
        fetchTodayQueue();
      }
    } catch (err) {
      console.error(err);
      setCheckInErr("Failed to complete check-in.");
    } finally {
      setIsSavingCheckIn(false);
    }
  };


  // Schedule Appointment Form Handler
  const handleScheduleAppointment = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !hospitalId) return;

    setIsSavingAppointment(true);
    setAppointmentMsg("");
    setAppointmentErr("");

    const payload = {
      ...appointmentForm,
      appointmentAt: new Date(appointmentForm.appointmentAt).toISOString(),
      hospitalId,
    };

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setAppointmentErr(data.message);
      } else {
        setAppointmentMsg(`Appointment scheduled successfully! No: ${data.data.appointmentNo}`);
        setAppointmentForm(initialAppointmentForm);
        fetchAppointments();
        fetchTodayQueue();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingAppointment(false);
    }
  };

  // Update Appointment Handler
  const handleUpdateAppointment = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !editingAppointment) return;

    setIsSavingEditAppt(true);
    setEditApptMsg("");
    setEditApptErr("");

    try {
      const res = await fetch(`/api/appointments/${editingAppointment.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: editApptForm.doctorId || undefined,
          appointmentAt: editApptForm.appointmentAt ? new Date(editApptForm.appointmentAt).toISOString() : undefined,
          status: editApptForm.status || undefined,
          notes: editApptForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setEditApptErr(data.message);
      } else {
        setEditApptMsg("Appointment updated successfully!");
        setEditingAppointment(null);
        fetchAppointments();
        fetchTodayQueue();
      }
    } catch (err) {
      console.error(err);
      setEditApptErr("Failed to update appointment.");
    } finally {
      setIsSavingEditAppt(false);
    }
  };

  // Quick status update
  const handleUpdateAppointmentStatus = async (apptId: string, newStatus: string) => {
    if (!token) return;
    try {
      await fetch(`/api/appointments/${apptId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchAppointments();
      fetchTodayQueue();
    } catch (err) {
      console.error(err);
    }
  };

  // Doctor Action: Start OPD visit from appointment
  const handleStartOpdVisit = async (appt: Appointment) => {
    if (!token || !hospitalId) return;
    setOpdErr("");
    setOpdMsg("");

    const payload = {
      patientId: appt.patient.id,
      appointmentId: appt.id,
      chiefComplaint: appt.notes || "",
      hospitalId,
    };

    try {
      const res = await fetch("/api/opd-visits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setOpdErr(data.message);
      } else {
        setActiveOpdVisit(data.data);
        setSelectedPatient(appt.patient);
        setOpdForm({
          chiefComplaint: data.data.chiefComplaint || "",
          diagnosis: data.data.diagnosis || "",
          clinicalNotes: data.data.clinicalNotes || "",
          treatmentPlan: data.data.treatmentPlan || "",
          status: "OPEN",
          temperature: "",
          pulse: "",
          respiratoryRate: "",
          bloodPressure: "",
          oxygenSaturation: "",
          height: "",
          weight: "",
          bmi: "",
          prescriptionNotes: "",
        });
        setPrescriptionRows([blankPrescriptionRow]);
        setOpdMsg(`OPD Visit started: ${data.data.visitNo}`);
        
        // Update appointment status to IN_CONSULTATION
        await fetch(`/api/appointments/${appt.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "IN_CONSULTATION" }),
        });
        fetchTodayQueue();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Doctor Action: Save OPD details
  const handleSaveOpdVisit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !activeOpdVisit) return;

    setIsSavingOpd(true);
    setOpdMsg("");
    setOpdErr("");

    const items = prescriptionRows.filter((r) => r.medicineName.trim());

    try {
      const res = await fetch(`/api/opd-visits/${activeOpdVisit.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chiefComplaint: opdForm.chiefComplaint,
          diagnosis: opdForm.diagnosis,
          clinicalNotes: opdForm.clinicalNotes,
          treatmentPlan: opdForm.treatmentPlan,
          status: opdForm.status,
          vitals: {
            temperature: opdForm.temperature || null,
            pulse: opdForm.pulse ? Number(opdForm.pulse) : null,
            respiratoryRate: opdForm.respiratoryRate ? Number(opdForm.respiratoryRate) : null,
            bloodPressure: opdForm.bloodPressure || null,
            oxygenSaturation: opdForm.oxygenSaturation ? Number(opdForm.oxygenSaturation) : null,
            height: opdForm.height || null,
            weight: opdForm.weight || null,
            bmi: opdForm.bmi || null,
          },
          prescriptionNotes: opdForm.prescriptionNotes,
          prescriptionItems: items,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setOpdErr(data.message);
      } else {
        setOpdMsg("OPD visit saved successfully!");
        
        // If status completed, update appointment status to COMPLETED
        if (opdForm.status === "COMPLETED" && activeOpdVisit.appointment?.id) {
          await fetch(`/api/appointments/${activeOpdVisit.appointment.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: "COMPLETED" }),
          });
        }
        
        setActiveOpdVisit(null);
        setSelectedPatient(null);
        fetchTodayQueue();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingOpd(false);
    }
  };

  const handleAddPrescriptionRow = () => {
    setPrescriptionRows((curr) => [...curr, { ...blankPrescriptionRow }]);
  };

  const handleUpdatePrescriptionRow = (idx: number, field: keyof PrescriptionDraft, val: string) => {
    setPrescriptionRows((curr) =>
      curr.map((r, i) => (i === idx ? { ...r, [field]: val } : r))
    );
  };

  const handleRemovePrescriptionRow = (idx: number) => {
    setPrescriptionRows((curr) => curr.filter((_, i) => i !== idx));
  };

  // Open Patient Full Profile
  const handleOpenPatientProfile = (pat: Patient) => {
    setSelectedPatient(pat);
    fetchPatientOpdHistory(pat.id);
    setActiveTab("patients");
  };

  const handlePrintPatientSlip = (patient: Patient, type: "REGISTRATION" | "CONSULTATION", opdVisit?: OpdVisit) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print slips.");
      return;
    }

    const hName = hospitalName || "MEDFLOW MEDICAL FACILITY";
    const logoUrl = hospitalLogo || "";

    const dateStr = opdVisit?.createdAt 
      ? new Date(opdVisit.createdAt).toLocaleString() 
      : new Date().toLocaleString();

    let contentHtml = `
      <html>
        <head>
          <title>Patient Slip - ${patient.patientCode}</title>
          <style>
            @media print {
              body { margin: 1.5cm; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #20231f;
              font-size: 13px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #2f5d50;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .hospital-info h2 {
              margin: 0;
              font-size: 20px;
              color: #2f5d50;
              font-weight: 800;
            }
            .hospital-info p {
              margin: 2px 0 0 0;
              font-size: 11px;
              color: #626a62;
            }
            .logo {
              max-height: 50px;
              object-fit: contain;
            }
            .title {
              text-align: center;
              font-weight: bold;
              font-size: 14px;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              margin-bottom: 20px;
              color: #2f5d50;
              border: 1px solid #dfe4d9;
              padding: 6px;
              background-color: #fcfdfc;
            }
            .section-title {
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              color: #2f5d50;
              border-bottom: 1px solid #dfe4d9;
              padding-bottom: 4px;
              margin-top: 20px;
              margin-bottom: 10px;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .patient-details {
              border: 1px solid #dfe4d9;
              padding: 12px;
              border-radius: 6px;
              background-color: #fcfdfc;
              margin-bottom: 20px;
            }
            .patient-details div {
              margin-bottom: 6px;
            }
            .patient-details span.label {
              color: #626a62;
              font-weight: 500;
              width: 120px;
              display: inline-block;
            }
            .patient-details span.value {
              font-weight: bold;
            }
            .blank-lines {
              margin-top: 30px;
              border: 1px dashed #cfd6ca;
              border-radius: 6px;
              padding: 20px;
              min-height: 400px;
              background-color: #fafbfa;
            }
            .blank-lines p {
              color: #a0a59e;
              font-style: italic;
              margin-top: 0;
            }
            .vitals-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 15px;
            }
            .vital-box {
              border: 1px solid #dfe4d9;
              padding: 8px;
              border-radius: 4px;
              text-align: center;
            }
            .vital-name {
              font-size: 9px;
              color: #626a62;
              text-transform: uppercase;
              font-weight: bold;
            }
            .vital-val {
              font-size: 13px;
              font-weight: bold;
              margin-top: 2px;
            }
            .prescription-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            .prescription-table th, .prescription-table td {
              border: 1px solid #dfe4d9;
              padding: 8px;
              text-align: left;
            }
            .prescription-table th {
              background-color: #f3f5f0;
              color: #2f5d50;
              font-size: 11px;
              text-transform: uppercase;
            }
            .footer {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .signature-box {
              border-top: 1px solid #626a62;
              width: 200px;
              text-align: center;
              padding-top: 6px;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="hospital-info">
              <h2>${hName}</h2>
              <p>OPD & Clinical Registry Services</p>
            </div>
            ${logoUrl ? `<img class="logo" src="${logoUrl}" />` : ""}
          </div>

          <div class="title">
            ${type === "REGISTRATION" ? "Patient Registration Slip" : "Clinical Consultation Slip"}
          </div>

          <div class="patient-details">
            <div class="grid-2">
              <div>
                <span class="label">Patient Code:</span>
                <span class="value">${patient.patientCode}</span>
              </div>
              <div>
                <span class="label">Slip Date/Time:</span>
                <span class="value">${dateStr}</span>
              </div>
              <div>
                <span class="label">Patient Name:</span>
                <span class="value">${[patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ")}</span>
              </div>
              <div>
                <span class="label">Gender / Age:</span>
                <span class="value">${patient.gender} / ${patient.dateOfBirth ? Math.floor((new Date().getTime() - new Date(patient.dateOfBirth).getTime()) / 31557600000) + ' Yrs' : 'N/A'}</span>
              </div>
              <div>
                <span class="label">Contact Phone:</span>
                <span class="value">${patient.phone || "N/A"}</span>
              </div>
              <div>
                <span class="label">Aadhaar Card:</span>
                <span class="value font-mono">${patient.aadhaarNumber || "N/A"}</span>
              </div>
            </div>
          </div>

          ${type === "REGISTRATION" ? `
            <div class="blank-lines">
              <p>Clinical Notes & Physical Examination (Manual Entry Area):</p>
              <div style="border-bottom: 1px dashed #cfd6ca; margin-top: 40px;"></div>
              <div style="border-bottom: 1px dashed #cfd6ca; margin-top: 40px;"></div>
              <div style="border-bottom: 1px dashed #cfd6ca; margin-top: 40px;"></div>
              <div style="border-bottom: 1px dashed #cfd6ca; margin-top: 40px;"></div>
              <div style="border-bottom: 1px dashed #cfd6ca; margin-top: 40px;"></div>
              <div style="border-bottom: 1px dashed #cfd6ca; margin-top: 40px;"></div>
              <div style="border-bottom: 1px dashed #cfd6ca; margin-top: 40px;"></div>
            </div>
          ` : `
            <div>
              ${opdVisit?.vitals ? `
                <div class="section-title">Recorded Vitals</div>
                <div class="vitals-grid">
                  <div class="vital-box">
                    <div class="vital-name">Blood Pressure</div>
                    <div class="vital-val">${opdVisit.vitals.bloodPressure || "N/A"}</div>
                  </div>
                  <div class="vital-box">
                    <div class="vital-name">Pulse Rate</div>
                    <div class="vital-val">${opdVisit.vitals.pulse ? `${opdVisit.vitals.pulse} bpm` : "N/A"}</div>
                  </div>
                  <div class="vital-box">
                    <div class="vital-name">Temperature</div>
                    <div class="vital-val">${opdVisit.vitals.temperature ? `${opdVisit.vitals.temperature} °C` : "N/A"}</div>
                  </div>
                  <div class="vital-box">
                    <div class="vital-name">Weight / Height</div>
                    <div class="vital-val">${[opdVisit.vitals.weight ? `${opdVisit.vitals.weight}kg` : '', opdVisit.vitals.height ? `${opdVisit.vitals.height}cm` : ''].filter(Boolean).join(" / ") || "N/A"}</div>
                  </div>
                </div>
              ` : ""}

              ${opdVisit?.chiefComplaint ? `
                <div class="section-title">Chief Complaint</div>
                <div style="padding: 5px 0;">${opdVisit.chiefComplaint}</div>
              ` : ""}

              ${opdVisit?.diagnosis ? `
                <div class="section-title">Diagnosis / Assessment</div>
                <div style="padding: 5px 0; font-weight: bold; color: #2f5d50;">${opdVisit.diagnosis}</div>
              ` : ""}

              ${opdVisit?.clinicalNotes ? `
                <div class="section-title">Clinical Notes</div>
                <div style="padding: 5px 0; white-space: pre-wrap;">${opdVisit.clinicalNotes}</div>
              ` : ""}

              ${opdVisit?.treatmentPlan ? `
                <div class="section-title">Treatment Plan</div>
                <div style="padding: 5px 0;">${opdVisit.treatmentPlan}</div>
              ` : ""}

              ${opdVisit?.prescription && opdVisit.prescription.items && opdVisit.prescription.items.length > 0 ? `
                <div class="section-title">Rx (Prescribed Medications)</div>
                <table class="prescription-table">
                  <thead>
                    <tr>
                      <th style="width: 5%">#</th>
                      <th style="width: 45%">Medicine Name</th>
                      <th style="width: 25%">Dosage / Frequency</th>
                      <th style="width: 25%">Duration / Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${opdVisit.prescription.items.map((item, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td style="font-weight: bold;">${item.medicineName}</td>
                        <td>${[item.dosage, item.frequency].filter(Boolean).join(" - ")}</td>
                        <td>${[item.duration, item.instructions].filter(Boolean).join(" - ")}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
                ${opdVisit.prescription.notes ? `
                  <div style="margin-top: 8px; font-style: italic; font-size: 11px; color: #626a62;">
                    <strong>Notes:</strong> ${opdVisit.prescription.notes}
                  </div>
                ` : ""}
              ` : ""}
            </div>
          `}

          <div class="footer">
            <div>
              <p style="font-size: 10px; color: #a0a59e; margin: 0;">Generated by MedFlow EHR System</p>
            </div>
            <div class="signature-box">
              ${type === "CONSULTATION" ? "Consulting Doctor Signature" : "Reception Desk Signature"}
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(contentHtml);
    printWindow.document.close();
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("hospital_token");
    localStorage.removeItem("hospital_user");
    router.push("/login");
  };

  return (
    <main className="h-screen overflow-hidden bg-[#f7f7f4] text-[#20231f] flex flex-col md:flex-row">
      {/* Mobile Sidebar Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden animate-fade-in"
        />
      )}

      {/* Mobile Top Header Bar */}
      <div className="md:hidden bg-white border-b border-[#dfe4d9] px-4 py-3 flex items-center justify-between sticky top-0 z-30 w-full">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#477063]">
            MedFlow
          </p>
          <span className="text-[10px] bg-[#eef3eb] text-[#2f5d50] px-2 py-0.5 rounded font-bold capitalize">
            {role.replace("_", " ")}
          </span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1 text-[#20231f] focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      {/* Sidebar - Desktop and Mobile Drawer */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 border-r border-[#dfe4d9] bg-white flex flex-col justify-between transition-transform duration-300
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div>
          <div className="p-6 border-b border-[#dfe4d9] flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-[#151917] truncate">{hospitalName || "Medflow Facility"}</h1>
              <p className="text-xs text-[#626a62] mt-0.5 capitalize">
                {user?.employee?.designation || role.replace("_", " ")}
              </p>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-1 text-[#626a62] hover:text-red-500 font-bold"
            >
              ✕
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {role === "receptionist" && (
              <>
                <button
                  onClick={() => handleTabChange("dashboard")}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                    activeTab === "dashboard" ? "bg-[#eef3eb] text-[#2f5d50]" : "text-[#626a62] hover:bg-[#f3f5f0]"
                  }`}
                >
                  Dashboard Queue
                </button>
                <button
                  onClick={() => handleTabChange("patients")}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                    activeTab === "patients" ? "bg-[#eef3eb] text-[#2f5d50]" : "text-[#626a62] hover:bg-[#f3f5f0]"
                  }`}
                >
                  Patient Registry & Check-In
                </button>
                <button
                  onClick={() => handleTabChange("appointments")}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                    activeTab === "appointments" ? "bg-[#eef3eb] text-[#2f5d50]" : "text-[#626a62] hover:bg-[#f3f5f0]"
                  }`}
                >
                  Appointments Desk
                </button>
              </>
            )}

            {role === "doctor" && (
              <>
                <button
                  onClick={() => handleTabChange("dashboard")}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                    activeTab === "dashboard" ? "bg-[#eef3eb] text-[#2f5d50]" : "text-[#626a62] hover:bg-[#f3f5f0]"
                  }`}
                >
                  My Today's Queue
                </button>
                <button
                  onClick={() => handleTabChange("patients")}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                    activeTab === "patients" ? "bg-[#eef3eb] text-[#2f5d50]" : "text-[#626a62] hover:bg-[#f3f5f0]"
                  }`}
                >
                  Patients Directory
                </button>
              </>
            )}

            {role === "accountant" && (
              <button
                onClick={() => handleTabChange("billing")}
                className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                  activeTab === "billing" ? "bg-[#eef3eb] text-[#2f5d50]" : "text-[#626a62] hover:bg-[#f3f5f0]"
                }`}
              >
                Billing Desk console
              </button>
            )}

            {role === "lab_technician" && (
              <>
                <button
                  onClick={() => handleTabChange("lab")}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                    activeTab === "lab" ? "bg-[#eef3eb] text-[#2f5d50]" : "text-[#626a62] hover:bg-[#f3f5f0]"
                  }`}
                >
                  Laboratory requests
                </button>
                <button
                  onClick={() => handleTabChange("radiology")}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                    activeTab === "radiology" ? "bg-[#eef3eb] text-[#2f5d50]" : "text-[#626a62] hover:bg-[#f3f5f0]"
                  }`}
                >
                  Radiology requests
                </button>
              </>
            )}
            {enabledModules.includes("REPORTS") && (
              <button
                onClick={() => handleTabChange("reports")}
                className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-md transition ${
                  activeTab === "reports" ? "bg-[#eef3eb] text-[#2f5d50]" : "text-[#626a62] hover:bg-[#f3f5f0]"
                }`}
              >
                Operational Reports
              </button>
            )}
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

      {/* Content Area */}
      <section className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Receptionist/Doctor Dashboard: Today's Queue */}
        {activeTab === "dashboard" && (role === "receptionist" || role === "doctor") && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">
                {role === "doctor" ? "My Appointments Queue" : "Today's Patient Queue"}
              </h2>
              <p className="text-sm text-[#626a62] mt-1">
                Patients lined up for medical consultation today.
              </p>
            </div>

            <div className="grid xl:grid-cols-[1.2fr_1fr] gap-6">
              {/* Today Queue list */}
              <Surface title="Today's Consultation Lineup">
                {isLoadingToday ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[#626a62] gap-3">
                    <svg className="animate-spin h-8 w-8 text-[#2f5d50]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wider">Loading queue lineup...</span>
                  </div>
                ) : todayAppointments.length === 0 ? (
                  <p className="text-center py-8 text-[#626a62]">No appointments lined up for today.</p>
                ) : (
                  <div className="space-y-3">
                    {todayAppointments.map((appt) => (
                      <div key={appt.id} className="p-4 border border-[#d8ddd3] bg-white rounded-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#2f5d50] text-sm">{appt.appointmentNo}</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider bg-[#eef3eb] text-[#4b5f43] px-2 py-0.5 rounded">
                              {appt.status}
                            </span>
                          </div>
                          <p className="font-bold text-sm mt-1">
                            {[appt.patient.firstName, appt.patient.lastName].filter(Boolean).join(" ")}
                          </p>
                          <p className="text-xs text-[#626a62] mt-0.5">
                            Doc: {appt.doctor?.fullName || "Unassigned"} / Time: {new Date(appt.appointmentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenPatientProfile(appt.patient)}
                            className="h-8 px-3 border border-[#cfd6ca] text-xs font-semibold rounded hover:bg-[#f3f5f0]"
                          >
                            Open Demographics
                          </button>

                          {role === "doctor" && appt.status !== "COMPLETED" && appt.status !== "CANCELLED" && (
                            <button
                              onClick={() => handleStartOpdVisit(appt)}
                              className="h-8 px-3 text-white bg-[#2f5d50] text-xs font-semibold rounded hover:bg-[#24483e]"
                            >
                              Start Medical OPD
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>

              {/* Consultation panel for Doctor */}
              {role === "doctor" && (
                <div>
                  {activeOpdVisit ? (
                    <>
                    <Surface title={`Medical consultation: ${activeOpdVisit.visitNo}`} description={`Patient: ${selectedPatient ? [selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(" ") : ""}`}>
                      <form onSubmit={handleSaveOpdVisit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold">Chief Complaint</label>
                          <textarea
                            value={opdForm.chiefComplaint}
                            onChange={(e) => setOpdForm({ ...opdForm, chiefComplaint: e.target.value })}
                            className="mt-2 block w-full h-16 px-3 py-2 border border-[#cfd6ca] rounded-md text-sm bg-white"
                          />
                        </div>

                        {/* Vitals */}
                        <div className="p-4 border border-[#d8ddd3] bg-[#fcfdfc] rounded-lg">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#2f5d50]">Patient Vitals</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                            <div>
                              <label className="text-[10px] font-bold text-[#626a62]">Temp (°C)</label>
                              <input
                                type="text"
                                value={opdForm.temperature}
                                onChange={(e) => setOpdForm({ ...opdForm, temperature: e.target.value })}
                                className="block w-full h-9 border border-[#cfd6ca] rounded bg-white px-2 mt-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-[#626a62]">BP (mmHg)</label>
                              <input
                                type="text"
                                value={opdForm.bloodPressure}
                                onChange={(e) => setOpdForm({ ...opdForm, bloodPressure: e.target.value })}
                                className="block w-full h-9 border border-[#cfd6ca] rounded bg-white px-2 mt-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-[#626a62]">Pulse (bpm)</label>
                              <input
                                type="number"
                                value={opdForm.pulse}
                                onChange={(e) => setOpdForm({ ...opdForm, pulse: e.target.value })}
                                className="block w-full h-9 border border-[#cfd6ca] rounded bg-white px-2 mt-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold">Diagnosis</label>
                          <textarea
                            value={opdForm.diagnosis}
                            onChange={(e) => setOpdForm({ ...opdForm, diagnosis: e.target.value })}
                            className="mt-2 block w-full h-16 px-3 py-2 border border-[#cfd6ca] rounded-md text-sm bg-white"
                            placeholder="Primary diagnosis assessment..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold">Clinical Notes</label>
                          <textarea
                            value={opdForm.clinicalNotes}
                            onChange={(e) => setOpdForm({ ...opdForm, clinicalNotes: e.target.value })}
                            className="mt-2 block w-full h-16 px-3 py-2 border border-[#cfd6ca] rounded-md text-sm bg-white"
                            placeholder="Symptoms, findings, clinical notes..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold">Treatment Plan</label>
                          <textarea
                            value={opdForm.treatmentPlan}
                            onChange={(e) => setOpdForm({ ...opdForm, treatmentPlan: e.target.value })}
                            className="mt-2 block w-full h-16 px-3 py-2 border border-[#cfd6ca] rounded-md text-sm bg-white"
                            placeholder="Treatment plan, advice, diagnostic tests ordered..."
                          />
                        </div>

                        {/* Prescriptions */}
                        <div className="p-4 border border-[#d8ddd3] bg-[#fcfdfc] rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#2f5d50]">Prescribed Medicines</p>
                            <button
                              type="button"
                              onClick={handleAddPrescriptionRow}
                              className="px-2 py-1 border border-[#cfd6ca] text-[10px] font-bold rounded hover:bg-[#f3f5f0]"
                            >
                              + Add Medicine
                            </button>
                          </div>

                          <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                            {prescriptionRows.map((row, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  placeholder="Medicine Name"
                                  value={row.medicineName}
                                  onChange={(e) => handleUpdatePrescriptionRow(idx, "medicineName", e.target.value)}
                                  className="w-1/2 h-8 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                                />
                                <input
                                  type="text"
                                  placeholder="Dosage"
                                  value={row.dosage}
                                  onChange={(e) => handleUpdatePrescriptionRow(idx, "dosage", e.target.value)}
                                  className="w-1/4 h-8 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemovePrescriptionRow(idx)}
                                  className="text-red-500 text-xs px-2 hover:bg-red-50 rounded"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold">Consultation Status</label>
                          <select
                            value={opdForm.status}
                            onChange={(e) => setOpdForm({ ...opdForm, status: e.target.value })}
                            className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                          >
                            <option value="OPEN">Open (Keep Consultation active)</option>
                            <option value="COMPLETED">Completed (Close OPD file)</option>
                          </select>
                        </div>

                        {opdMsg && (
                          <div className="rounded bg-[#eef8f1] p-3 text-xs text-[#27603a] font-semibold">
                            {opdMsg}
                          </div>
                        )}
                        {opdErr && (
                          <div className="rounded bg-[#fff0ef] p-3 text-xs text-[#9f2d24] font-semibold">
                            {opdErr}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isSavingOpd}
                          className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {isSavingOpd && (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {isSavingOpd ? "Saving Consultation..." : "Save Medical OPD Record"}
                        </button>
                      </form>
                    </Surface>

                    {/* Patient Clinical History & Demographics */}
                    <div className="mt-6">
                      <Surface title="Patient Clinical History & Demographics" description="Demographics details and historical medical visits.">
                        <div className="space-y-4 text-xs">
                          {selectedPatient && (
                            <div className="p-3 bg-[#f3f5f0] border border-[#d8ddd3] rounded-lg">
                              <p className="font-bold text-[#2f5d50] uppercase tracking-wider text-[10px]">Demographics</p>
                              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 mt-1.5">
                                <div><span className="text-[#626a62]">Name:</span> <span className="font-semibold">{[selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(" ")}</span></div>
                                <div><span className="text-[#626a62]">Gender:</span> <span className="font-semibold capitalize">{selectedPatient.gender.toLowerCase()}</span></div>
                                <div><span className="text-[#626a62]">Blood Group:</span> <span className="font-semibold">{selectedPatient.bloodGroup?.replace("_", " ") || "N/A"}</span></div>
                                <div><span className="text-[#626a62]">Phone:</span> <span className="font-semibold">{selectedPatient.phone || "N/A"}</span></div>
                              </div>
                            </div>
                          )}

                          <div className="border-t border-[#dfe4d9] pt-3">
                            <p className="font-bold text-[#2f5d50] uppercase tracking-wider text-[10px] mb-2">Previous OPD Visits</p>
                            {isLoadingHistory ? (
                              <div className="flex flex-col items-center justify-center py-6 text-[#626a62] gap-2">
                                <svg className="animate-spin h-5 w-5 text-[#2f5d50]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-[10px] font-semibold uppercase tracking-wider">Loading history...</span>
                              </div>
                            ) : opdHistory.filter(h => h.id !== activeOpdVisit.id).length === 0 ? (
                              <p className="text-xs text-[#626a62] italic">No previous consultations found.</p>
                            ) : (
                              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {opdHistory.filter(h => h.id !== activeOpdVisit.id).map((visit) => (
                                  <div key={visit.id} className="p-3 border border-[#d8ddd3] bg-[#fcfdfc] rounded-lg space-y-2">
                                    <div className="flex justify-between font-bold text-[11px]">
                                      <span>{visit.visitNo}</span>
                                      <span className="text-[#626a62] font-normal">{new Date(visit.createdAt || "").toLocaleDateString()}</span>
                                    </div>
                                    <p><span className="text-[#626a62]">Complaint:</span> {visit.chiefComplaint || "None"}</p>
                                    <p><span className="text-[#626a62]">Diagnosis:</span> <span className="font-semibold text-[#2f5d50]">{visit.diagnosis || "Pending"}</span></p>
                                    {visit.clinicalNotes && <p><span className="text-[#626a62]">Notes:</span> {visit.clinicalNotes}</p>}
                                    {visit.treatmentPlan && <p><span className="text-[#626a62]">Treatment:</span> {visit.treatmentPlan}</p>}
                                    {visit.prescription && visit.prescription.items && visit.prescription.items.length > 0 && (
                                      <div className="mt-1 p-2 bg-amber-50/50 border border-amber-200 rounded">
                                        <p className="text-[9px] font-bold text-amber-800 uppercase tracking-wider mb-1">Prescription</p>
                                        <div className="space-y-0.5 text-[10px]">
                                          {visit.prescription.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between">
                                              <span className="font-semibold">{item.medicineName}</span>
                                              <span className="text-[#626a62]">{[item.dosage, item.frequency, item.duration].filter(Boolean).join(" • ")}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex justify-end pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handlePrintPatientSlip(selectedPatient!, "CONSULTATION", visit)}
                                        className="px-2 py-0.5 border border-[#cfd6ca] text-[9px] font-bold rounded hover:bg-[#f3f5f0]"
                                      >
                                        Print Slip
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Surface>
                    </div>
                    </>
                  ) : (
                    <div className="h-full border border-dashed border-[#dfe4d9] rounded-lg flex flex-col justify-center text-center p-8 text-[#626a62]">
                      <p className="text-sm font-bold uppercase tracking-wider text-[#2f5d50]">Medical Console</p>
                      <h4 className="font-bold text-sm mt-2 text-[#20231f]">No active consultation</h4>
                      <p className="text-xs mt-1">Select "Start Medical OPD" on any patient in the queue to begin documenting clinical notes.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Patients (Receptionist / Doctor View - Unified Check-In Desk) */}
        {activeTab === "patients" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#151917]">Patient check-in & Registry Desk</h2>
                <p className="text-sm text-[#626a62] mt-1">
                  Lookup patients, check them in with initial vitals, or register new profiles.
                </p>
              </div>

              {role === "receptionist" && (
                <button
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientForm(initialPatientForm);
                    setPatientMsg("");
                    setPatientErr("");
                    setCheckInMsg("");
                    setCheckInErr("");
                  }}
                  className="h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition"
                >
                  + Register New Patient
                </button>
              )}
            </div>

            <div className="flex flex-col gap-6">
              {/* Directory */}
              <div className="space-y-4 order-2">
                <input
                  type="text"
                  placeholder="Search patient by Aadhaar, Code, Name, Phone..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setPatientPage(1);
                  }}
                  className="w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20"
                />

                <Surface title="Registered Patients">
                  {isLoadingPatients ? (
                    <div className="flex flex-col items-center justify-center py-12 text-[#626a62] gap-3">
                      <svg className="animate-spin h-8 w-8 text-[#2f5d50]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider">Loading database...</span>
                    </div>
                  ) : patients.length === 0 ? (
                    <p className="text-center py-8 text-[#626a62]">No patients matched.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-[#f3f5f0] text-xs uppercase tracking-wider text-[#626a62]">
                            <tr>
                              <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Code</th>
                              <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Name</th>
                              <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Gender</th>
                              <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Aadhaar</th>
                              <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Phone</th>
                              <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {patients.map((p) => (
                              <tr key={p.id} className="border-b border-[#edf0e9] hover:bg-[#fcfdfc] transition">
                                <td className="px-4 py-3 font-semibold text-[#2f5d50]">{p.patientCode}</td>
                                <td className="px-4 py-3 font-medium">{[p.firstName, p.lastName].filter(Boolean).join(" ")}</td>
                                <td className="px-4 py-3 capitalize text-xs">{p.gender.toLowerCase()}</td>
                                <td className="px-4 py-3 font-mono text-xs">{p.aadhaarNumber || "N/A"}</td>
                                <td className="px-4 py-3">{p.phone || "N/A"}</td>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPatientProfile(p)}
                                    className="text-xs px-2.5 py-1 border border-[#cfd6ca] rounded hover:bg-[#f3f5f0] font-semibold"
                                  >
                                    Select
                                  </button>
                                </td>
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

              {/* Patient Profile / Registration Form */}
              <div className="order-1">
                {selectedPatient ? (
                  <div className="space-y-6">
                    <Surface title={`Profile: ${selectedPatient.patientCode}`} description="Patient demographics & files history.">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-[#2f5d50]">Patient Details</p>
                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2 text-xs">
                              <div>
                                <span className="text-[#626a62]">Name:</span> <span className="font-semibold">{[selectedPatient.firstName, selectedPatient.middleName, selectedPatient.lastName].filter(Boolean).join(" ")}</span>
                              </div>
                              <div>
                                <span className="text-[#626a62]">Gender:</span> <span className="font-semibold capitalize">{selectedPatient.gender.toLowerCase()}</span>
                              </div>
                              <div>
                                <span className="text-[#626a62]">Phone:</span> <span className="font-semibold">{selectedPatient.phone || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-[#626a62]">Blood Group:</span> <span className="font-semibold">{selectedPatient.bloodGroup?.replace("_", " ") || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-[#626a62]">Aadhaar:</span> <span className="font-semibold font-mono">{selectedPatient.aadhaarNumber || "N/A"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handlePrintPatientSlip(selectedPatient, "REGISTRATION")}
                              className="text-xs px-2.5 py-1 border border-[#cfd6ca] bg-[#eef3eb] text-[#2f5d50] hover:bg-[#e4ebde] font-bold rounded"
                            >
                              Print Blank Slip
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPatient(null)}
                              className="text-xs px-2 py-1 border border-[#cfd6ca] text-red-600 rounded hover:bg-red-50"
                            >
                              Close
                            </button>
                          </div>
                        </div>

                        {/* OPD medical visits history */}
                        <div className="border-t border-[#dfe4d9] pt-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#2f5d50]">Medical consults History</p>
                          {isLoadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-8 text-[#626a62] gap-2">
                              <svg className="animate-spin h-6 w-6 text-[#2f5d50]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="text-[10px] font-semibold uppercase tracking-wider">Loading medical file...</span>
                            </div>
                          ) : opdHistory.length === 0 ? (
                            <p className="text-xs text-[#626a62] py-2">No consult files documented.</p>
                          ) : (
                            <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto">
                              {opdHistory.map((visit) => (
                                <div key={visit.id} className="p-3 border border-[#d8ddd3] bg-[#fcfdfc] rounded text-xs space-y-2">
                                  <div className="flex justify-between font-bold">
                                    <span>{visit.visitNo}</span>
                                    <span className="text-[#626a62] font-normal">{new Date(visit.createdAt || "").toLocaleDateString()}</span>
                                  </div>
                                  <p><span className="text-[#626a62]">Complaint:</span> {visit.chiefComplaint || "None"}</p>
                                  <p><span className="text-[#626a62]">Diagnosis:</span> {visit.diagnosis || "Pending"}</p>
                                  {visit.clinicalNotes && (
                                    <p><span className="text-[#626a62]">Clinical Notes:</span> {visit.clinicalNotes}</p>
                                  )}
                                  {visit.treatmentPlan && (
                                    <p><span className="text-[#626a62]">Treatment:</span> {visit.treatmentPlan}</p>
                                  )}
                                  {visit.vitals && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {visit.vitals.bloodPressure && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">BP: {visit.vitals.bloodPressure}</span>}
                                      {visit.vitals.pulse && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Pulse: {visit.vitals.pulse}</span>}
                                      {visit.vitals.temperature && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Temp: {visit.vitals.temperature}°C</span>}
                                    </div>
                                  )}
                                  {visit.prescription && visit.prescription.items && visit.prescription.items.length > 0 && (
                                    <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Prescription</p>
                                      <div className="space-y-0.5">
                                        {visit.prescription.items.map((item, idx) => (
                                          <div key={idx} className="flex justify-between text-[10px]">
                                            <span className="font-semibold">{item.medicineName}</span>
                                            <span className="text-[#626a62]">{[item.dosage, item.frequency, item.duration].filter(Boolean).join(" • ")}</span>
                                          </div>
                                        ))}
                                      </div>
                                      {visit.prescription.notes && (
                                        <p className="text-[10px] text-[#626a62] mt-1 italic">Note: {visit.prescription.notes}</p>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex justify-end pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handlePrintPatientSlip(selectedPatient, "CONSULTATION", visit)}
                                      className="px-2 py-0.5 border border-[#cfd6ca] text-[10px] font-bold rounded hover:bg-[#f3f5f0]"
                                    >
                                      Print Consultation Slip
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Surface>

                    {/* Check-In Form for receptionist */}
                    {role === "receptionist" && (
                      <>
                      <Surface title="Patient Vitals & Doctor Assignment Check-In" description="Assign a doctor and record initial clinical vitals checks immediately.">
                        <form onSubmit={handleExistingPatientCheckIn} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold">Consulting Doctor</label>
                              <select
                                value={checkInDoctorId}
                                onChange={(e) => setCheckInDoctorId(e.target.value)}
                                className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                              >
                                <option value="">Choose consulting doctor...</option>
                                {doctorsList.map((doc) => (
                                  <option key={doc.id} value={doc.id}>
                                    {doc.fullName} ({doc.department || "No Dept"})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold">Check-In Notes</label>
                              <input
                                type="text"
                                value={checkInNotes}
                                onChange={(e) => setCheckInNotes(e.target.value)}
                                className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                                placeholder="e.g. Regular review, acute fever"
                              />
                            </div>
                          </div>

                          <div className="p-3 border border-[#d8ddd3] bg-[#fcfdfc] rounded-lg">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2f5d50]">Immediate Vitals Check</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
                              <div>
                                <label className="text-[9px] font-bold text-[#626a62]">BP (mmHg)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 120/80"
                                  value={checkInVitals.bloodPressure}
                                  onChange={(e) => setCheckInVitals({ ...checkInVitals, bloodPressure: e.target.value })}
                                  className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#626a62]">O2 Saturation (%)</label>
                                <input
                                  type="number"
                                  placeholder="e.g. 98"
                                  value={checkInVitals.oxygenSaturation}
                                  onChange={(e) => setCheckInVitals({ ...checkInVitals, oxygenSaturation: e.target.value })}
                                  className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#626a62]">Pulse (bpm)</label>
                                <input
                                  type="number"
                                  placeholder="e.g. 72"
                                  value={checkInVitals.pulse}
                                  onChange={(e) => setCheckInVitals({ ...checkInVitals, pulse: e.target.value })}
                                  className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
                              <div>
                                <label className="text-[9px] font-bold text-[#626a62]">Temp (°C)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 36.8"
                                  value={checkInVitals.temperature}
                                  onChange={(e) => setCheckInVitals({ ...checkInVitals, temperature: e.target.value })}
                                  className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#626a62]">Weight (kg)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 70"
                                  value={checkInVitals.weight}
                                  onChange={(e) => setCheckInVitals({ ...checkInVitals, weight: e.target.value })}
                                  className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#626a62]">Height (cm)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 175"
                                  value={checkInVitals.height}
                                  onChange={(e) => setCheckInVitals({ ...checkInVitals, height: e.target.value })}
                                  className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={isSavingCheckIn}
                            className="w-full h-9 rounded text-xs font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60 flex items-center justify-center gap-2"
                          >
                            {isSavingCheckIn && (
                              <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            {isSavingCheckIn ? "Checking In..." : "Complete Check-In"}
                          </button>

                          {checkInMsg && (
                            <div className="rounded bg-[#eef8f1] p-3 text-xs text-[#27603a] font-semibold">
                              {checkInMsg}
                            </div>
                          )}
                          {checkInErr && (
                            <div className="rounded bg-[#fff0ef] p-3 text-xs text-[#9f2d24] font-semibold">
                              {checkInErr}
                            </div>
                          )}
                        </form>
                      </Surface>

                      <Surface title="Schedule Future Appointment" description={"Book a future consultation for " + selectedPatient.firstName + " " + (selectedPatient.lastName || "")}>
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          if (!token || !hospitalId || !selectedPatient) return;
                          setIsSavingAppointment(true);
                          setAppointmentMsg("");
                          setAppointmentErr("");
                          const payload = {
                            patientId: selectedPatient.id,
                            doctorId: appointmentForm.doctorId || undefined,
                            appointmentAt: new Date(appointmentForm.appointmentAt).toISOString(),
                            status: "SCHEDULED",
                            notes: appointmentForm.notes,
                            hospitalId,
                          };
                          fetch("/api/appointments", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify(payload),
                          })
                            .then(res => res.json())
                            .then(data => {
                              if (!data.success) setAppointmentErr(data.message);
                              else {
                                setAppointmentMsg(`Appointment scheduled! No: ${data.data.appointmentNo}`);
                                setAppointmentForm(initialAppointmentForm);
                                fetchAppointments();
                                fetchTodayQueue();
                              }
                            })
                            .catch(() => setAppointmentErr("Failed to schedule."))
                            .finally(() => setIsSavingAppointment(false));
                        }} className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold">Consulting Doctor</label>
                              <select
                                value={appointmentForm.doctorId}
                                onChange={(e) => setAppointmentForm({ ...appointmentForm, doctorId: e.target.value })}
                                className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                              >
                                <option value="">Choose doctor...</option>
                                {doctorsList.map((doc) => (
                                  <option key={doc.id} value={doc.id}>
                                    {doc.fullName} ({doc.department || "No Dept"})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold">Date & Time</label>
                              <input
                                type="datetime-local"
                                required
                                value={appointmentForm.appointmentAt}
                                onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentAt: e.target.value })}
                                className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold">Notes / Reason</label>
                            <input
                              type="text"
                              value={appointmentForm.notes}
                              onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                              className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                              placeholder="e.g. Follow-up, Regular checkup"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isSavingAppointment}
                            className="w-full h-9 rounded text-xs font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60 flex items-center justify-center gap-2"
                          >
                            {isSavingAppointment && (
                              <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            {isSavingAppointment ? "Scheduling..." : "Schedule Appointment"}
                          </button>
                          {appointmentMsg && (
                            <div className="rounded bg-[#eef8f1] p-2 text-xs text-[#27603a] font-semibold">{appointmentMsg}</div>
                          )}
                          {appointmentErr && (
                            <div className="rounded bg-[#fff0ef] p-2 text-xs text-[#9f2d24] font-semibold">{appointmentErr}</div>
                          )}
                        </form>
                      </Surface>
                      </>
                    )}
                  </div>
                ) : role === "receptionist" ? (
                  <Surface title="New Patient Registration & Check-In" description="Register a new patient and check them in directly on a single screen.">
                    <form onSubmit={handleRegisterPatient} className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#2f5d50] border-b border-[#dfe4d9] pb-1">1. Demographics</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold">First Name</label>
                          <input
                            type="text"
                            required
                            value={patientForm.firstName}
                            onChange={(e) => setPatientForm({ ...patientForm, firstName: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold">Last Name</label>
                          <input
                            type="text"
                            required
                            value={patientForm.lastName}
                            onChange={(e) => setPatientForm({ ...patientForm, lastName: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold">Gender</label>
                          <select
                            value={patientForm.gender}
                            onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold">DOB (Date of birth)</label>
                          <input
                            type="date"
                            value={patientForm.dateOfBirth}
                            onChange={(e) => setPatientForm({ ...patientForm, dateOfBirth: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold">Phone</label>
                          <input
                            type="text"
                            required
                            value={patientForm.phone}
                            onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold">Blood Group</label>
                          <select
                            value={patientForm.bloodGroup}
                            onChange={(e) => setPatientForm({ ...patientForm, bloodGroup: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          >
                            <option value="">Select blood type...</option>
                            {["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"].map((bg) => (
                              <option key={bg} value={bg}>{bg.replace("_", " ")}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold">Aadhaar Card Number</label>
                          <input
                            type="text"
                            value={patientForm.aadhaarNumber || ""}
                            onChange={(e) => setPatientForm({ ...patientForm, aadhaarNumber: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                            placeholder="e.g. 1234 5678 9012"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold">Marital Status</label>
                          <select
                            value={patientForm.maritalStatus}
                            onChange={(e) => setPatientForm({ ...patientForm, maritalStatus: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          >
                            <option value="SINGLE">Single</option>
                            <option value="MARRIED">Married</option>
                            <option value="DIVORCED">Divorced</option>
                            <option value="WIDOWED">Widowed</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold">Address</label>
                        <input
                          type="text"
                          value={patientForm.address}
                          onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })}
                          className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-semibold">City</label>
                          <input
                            type="text"
                            value={patientForm.city}
                            onChange={(e) => setPatientForm({ ...patientForm, city: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold">State</label>
                          <input
                            type="text"
                            value={patientForm.state}
                            onChange={(e) => setPatientForm({ ...patientForm, state: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold">Pincode</label>
                          <input
                            type="text"
                            value={patientForm.pincode}
                            onChange={(e) => setPatientForm({ ...patientForm, pincode: e.target.value })}
                            className="mt-1 block w-full h-9 border border-[#cfd6ca] rounded bg-white text-xs px-2"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-[#2f5d50] uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={checkInImmediately}
                            onChange={(e) => setCheckInImmediately(e.target.checked)}
                            className="h-4 w-4 rounded border-[#cfd6ca]"
                          />
                          Check-In Immediately (Assign Doctor & Vitals)
                        </label>
                      </div>

                      {checkInImmediately && (
                        <div className="p-3 border border-[#d8ddd3] bg-[#fcfdfc] rounded-lg space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#2f5d50] border-b border-[#dfe4d9] pb-1">2. Assign Doctor & Check-In Vitals</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold">Consulting Doctor</label>
                              <select
                                required={checkInImmediately}
                                value={checkInDoctorId}
                                onChange={(e) => setCheckInDoctorId(e.target.value)}
                                className="mt-1 block w-full h-8 border border-[#cfd6ca] rounded bg-white text-[10px] px-2"
                              >
                                <option value="">Choose consulting doctor...</option>
                                {doctorsList.map((doc) => (
                                  <option key={doc.id} value={doc.id}>
                                    {doc.fullName} ({doc.department || "No Dept"})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold">Consultation Notes</label>
                              <input
                                type="text"
                                value={checkInNotes}
                                onChange={(e) => setCheckInNotes(e.target.value)}
                                className="mt-1 block w-full h-8 border border-[#cfd6ca] rounded bg-white text-[10px] px-2"
                                placeholder="e.g. Regular review"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-[#626a62]">BP (mmHg)</label>
                              <input
                                type="text"
                                placeholder="e.g. 120/80"
                                value={checkInVitals.bloodPressure}
                                onChange={(e) => setCheckInVitals({ ...checkInVitals, bloodPressure: e.target.value })}
                                className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-[#626a62]">O2 (%)</label>
                              <input
                                type="number"
                                placeholder="e.g. 98"
                                value={checkInVitals.oxygenSaturation}
                                onChange={(e) => setCheckInVitals({ ...checkInVitals, oxygenSaturation: e.target.value })}
                                className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-[#626a62]">Pulse (bpm)</label>
                              <input
                                type="number"
                                placeholder="e.g. 72"
                                value={checkInVitals.pulse}
                                onChange={(e) => setCheckInVitals({ ...checkInVitals, pulse: e.target.value })}
                                className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-[#626a62]">Temp (°C)</label>
                              <input
                                type="text"
                                placeholder="e.g. 36.8"
                                value={checkInVitals.temperature}
                                onChange={(e) => setCheckInVitals({ ...checkInVitals, temperature: e.target.value })}
                                className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-[#626a62]">Weight (kg)</label>
                              <input
                                type="text"
                                placeholder="e.g. 70"
                                value={checkInVitals.weight}
                                onChange={(e) => setCheckInVitals({ ...checkInVitals, weight: e.target.value })}
                                className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-[#626a62]">Height (cm)</label>
                              <input
                                type="text"
                                placeholder="e.g. 175"
                                value={checkInVitals.height}
                                onChange={(e) => setCheckInVitals({ ...checkInVitals, height: e.target.value })}
                                className="block w-full h-8 border border-[#cfd6ca] rounded bg-white px-2 mt-0.5 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSavingPatient}
                        className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {isSavingPatient && (
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {isSavingPatient ? "Saving Record..." : checkInImmediately ? "Register & Check-In Patient" : "Register Patient Only"}
                      </button>

                      {patientMsg && (
                        <div className="rounded bg-[#eef8f1] p-3 text-xs text-[#27603a] font-semibold flex items-center justify-between gap-3">
                          <span>{patientMsg}</span>
                          {lastRegisteredPatient && (
                            <button
                              type="button"
                              onClick={() => handlePrintPatientSlip(lastRegisteredPatient, "REGISTRATION")}
                              className="px-2.5 py-1 bg-[#2f5d50] text-white hover:bg-[#24483e] font-bold rounded text-[10px] whitespace-nowrap"
                            >
                              Print Slip
                            </button>
                          )}
                        </div>
                      )}
                      {patientErr && (
                        <div className="rounded bg-[#fff0ef] p-3 text-xs text-[#9f2d24] font-semibold">
                          {patientErr}
                        </div>
                      )}
                    </form>
                  </Surface>
                ) : (
                  <p className="text-center py-12 text-[#626a62]">Select a Patient to view history or start Check-In.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Appointments (Receptionist View) */}
        {activeTab === "appointments" && role === "receptionist" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Appointments Scheduling Desk</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Book and manage outpatient consultation schedules.
              </p>
            </div>

            <div className="grid xl:grid-cols-[1fr_420px] gap-6">
              {/* List */}
              <div className="space-y-4">
                <div className="flex gap-4 items-center">
                  <input
                    type="text"
                    placeholder="Search appointments..."
                    value={appointmentSearch}
                    onChange={(e) => setAppointmentSearch(e.target.value)}
                    className="w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white outline-none"
                  />
                  <select
                    value={appointmentStatus}
                    onChange={(e) => setAppointmentStatus(e.target.value)}
                    className="h-10 border border-[#cfd6ca] bg-white rounded-md text-sm px-3"
                  >
                    <option value="">All Statuses</option>
                    {["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED", "CANCELLED"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <Surface title="Scheduled Appointments Queue">
                  {isLoadingAppointments ? (
                    <div className="flex flex-col items-center justify-center py-12 text-[#626a62] gap-3">
                      <svg className="animate-spin h-8 w-8 text-[#2f5d50]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider">Loading appointments...</span>
                    </div>
                  ) : appointments.length === 0 ? (
                    <p className="text-center py-8 text-[#626a62]">No appointments scheduled.</p>
                  ) : (
                    <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-[#f3f5f0] text-xs uppercase tracking-wider text-[#626a62]">
                          <tr>
                            <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">No</th>
                            <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Patient</th>
                            <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Doctor</th>
                            <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Date/Time</th>
                            <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Status</th>
                            <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointments.map((a) => (
                            <tr key={a.id} className="border-b border-[#edf0e9] hover:bg-[#fcfdfc] transition">
                              <td className="px-4 py-3 font-semibold text-[#2f5d50]">{a.appointmentNo}</td>
                              <td className="px-4 py-3 font-medium">{[a.patient.firstName, a.patient.lastName].filter(Boolean).join(" ")}</td>
                              <td className="px-4 py-3">{a.doctor?.fullName || "Unassigned"}</td>
                              <td className="px-4 py-3 text-xs">
                                <div>{new Date(a.appointmentAt).toLocaleDateString()}</div>
                                <div className="text-[#626a62]">{new Date(a.appointmentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                  a.status === "COMPLETED" ? "bg-green-100 text-green-800" :
                                  a.status === "CANCELLED" ? "bg-red-100 text-red-800" :
                                  a.status === "IN_CONSULTATION" ? "bg-blue-100 text-blue-800" :
                                  "bg-[#eef3eb] text-[#4b5f43]"
                                }`}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1.5">
                                  {a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingAppointment(a);
                                        setEditApptForm({
                                          doctorId: a.doctor?.id || "",
                                          appointmentAt: new Date(a.appointmentAt).toISOString().slice(0, 16),
                                          status: a.status,
                                          notes: a.notes || "",
                                        });
                                      }}
                                      className="text-[10px] px-2 py-1 border border-[#cfd6ca] rounded font-semibold hover:bg-[#f3f5f0] transition"
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {a.status === "SCHEDULED" && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateAppointmentStatus(a.id, "CANCELLED")}
                                      className="text-[10px] px-2 py-1 border border-red-200 bg-red-50 text-red-600 rounded font-semibold hover:bg-red-100 transition"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#dfe4d9] mt-4">
                      <div className="text-xs text-[#626a62]">
                        Page <span className="font-semibold text-[#20231f]">{appointmentPagination.page}</span> of{" "}
                        <span className="font-semibold text-[#20231f]">{appointmentPagination.totalPages}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAppointmentPage(p => Math.max(p - 1, 1))}
                          disabled={appointmentPage <= 1}
                          className="h-8 px-3 text-xs font-semibold border border-[#cfd6ca] rounded hover:bg-[#f3f5f0] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setAppointmentPage(p => Math.min(p + 1, appointmentPagination.totalPages))}
                          disabled={appointmentPage >= appointmentPagination.totalPages}
                          className="h-8 px-3 text-xs font-semibold border border-[#cfd6ca] rounded hover:bg-[#f3f5f0] disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                    </>
                  )}
                </Surface>
              </div>

              {/* Form */}
              <Surface title="Schedule Appointment" description="Select patient, doctor, and consultation date. Appointment Code is auto-generated.">
                <form onSubmit={handleScheduleAppointment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold">Patient</label>
                    <select
                      required
                      value={appointmentForm.patientId}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, patientId: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                    >
                      <option value="">Choose patient...</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} ({p.patientCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">Doctor</label>
                    <select
                      required
                      value={appointmentForm.doctorId}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, doctorId: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                    >
                      <option value="">Choose consulting doctor...</option>
                      {doctorsList.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.fullName} ({doc.department || "No Department"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">Appointment Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={appointmentForm.appointmentAt}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentAt: e.target.value })}
                      className="mt-2 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold">Consultation Notes / Reason</label>
                    <textarea
                      value={appointmentForm.notes}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                      className="mt-2 block w-full h-16 px-3 py-2 border border-[#cfd6ca] rounded-md text-sm bg-white"
                      placeholder="e.g. Regular health checkup, chief complaint"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingAppointment}
                    className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isSavingAppointment && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isSavingAppointment ? "Scheduling..." : "Schedule Appointment"}
                  </button>

                  {appointmentMsg && (
                    <div className="rounded bg-[#eef8f1] p-3 text-xs text-[#27603a] font-semibold">
                      {appointmentMsg}
                    </div>
                  )}
                  {appointmentErr && (
                    <div className="rounded bg-[#fff0ef] p-3 text-xs text-[#9f2d24] font-semibold">
                      {appointmentErr}
                    </div>
                  )}
                </form>
              </Surface>

              {/* Edit Appointment Modal */}
              {editingAppointment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#151917]">Edit Appointment: {editingAppointment.appointmentNo}</h3>
                      <button type="button" onClick={() => setEditingAppointment(null)} className="text-[#626a62] hover:text-red-500 text-xl font-bold">✕</button>
                    </div>
                    <p className="text-xs text-[#626a62]">
                      Patient: <span className="font-semibold">{[editingAppointment.patient.firstName, editingAppointment.patient.lastName].filter(Boolean).join(" ")}</span>
                    </p>
                    <form onSubmit={handleUpdateAppointment} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold">Doctor</label>
                        <select
                          value={editApptForm.doctorId}
                          onChange={(e) => setEditApptForm({ ...editApptForm, doctorId: e.target.value })}
                          className="mt-1 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                        >
                          <option value="">Unassigned</option>
                          {doctorsList.map((doc) => (
                            <option key={doc.id} value={doc.id}>{doc.fullName} ({doc.department || "No Dept"})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold">Date & Time</label>
                        <input
                          type="datetime-local"
                          value={editApptForm.appointmentAt}
                          onChange={(e) => setEditApptForm({ ...editApptForm, appointmentAt: e.target.value })}
                          className="mt-1 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold">Status</label>
                        <select
                          value={editApptForm.status}
                          onChange={(e) => setEditApptForm({ ...editApptForm, status: e.target.value })}
                          className="mt-1 block w-full h-10 px-3 border border-[#cfd6ca] rounded-md text-sm bg-white"
                        >
                          {["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED", "CANCELLED"].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold">Notes</label>
                        <textarea
                          value={editApptForm.notes}
                          onChange={(e) => setEditApptForm({ ...editApptForm, notes: e.target.value })}
                          className="mt-1 block w-full h-16 px-3 py-2 border border-[#cfd6ca] rounded-md text-sm bg-white"
                          placeholder="Consultation notes"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSavingEditAppt}
                        className="w-full h-10 px-4 rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] transition disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {isSavingEditAppt && (
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {isSavingEditAppt ? "Updating..." : "Update Appointment"}
                      </button>
                      {editApptMsg && <div className="rounded bg-[#eef8f1] p-3 text-xs text-[#27603a] font-semibold">{editApptMsg}</div>}
                      {editApptErr && <div className="rounded bg-[#fff0ef] p-3 text-xs text-[#9f2d24] font-semibold">{editApptErr}</div>}
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Billing (Accountant view) */}
        {activeTab === "billing" && role === "accountant" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Billing Desk console</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Collect payments, generate invoices, and handle receipts.
              </p>
            </div>

            <BillingConsole
              token={token}
              user={{ userType: user?.userType || "HOSPITAL_USER", hospitalId }}
              effectiveHospitalId={hospitalId}
              patients={patients}
              selectedPatient={selectedPatient}
              activeOpdVisit={activeOpdVisit}
              onOpenPatient={handleOpenPatientProfile}
            />
          </div>
        )}

        {/* Tab 5: Lab (Lab Technician view) */}
        {activeTab === "lab" && role === "lab_technician" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Laboratory Requests Desk</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Manage laboratory test orders and record specimen values.
              </p>
            </div>

            <LabConsole
              token={token}
              user={{ userType: user?.userType || "HOSPITAL_USER", hospitalId }}
              effectiveHospitalId={hospitalId}
              patients={patients}
              selectedPatient={selectedPatient}
              activeOpdVisit={activeOpdVisit}
              employees={employeesList}
              onOpenPatient={handleOpenPatientProfile}
            />
          </div>
        )}

        {/* Tab 6: Radiology (Lab Technician view) */}
        {activeTab === "radiology" && role === "lab_technician" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Radiology Requests Desk</h2>
              <p className="text-sm text-[#626a62] mt-1">
                Manage imaging diagnostic procedures and record findings.
              </p>
            </div>

            <RadiologyConsole
              token={token}
              user={{ userType: user?.userType || "HOSPITAL_USER", hospitalId }}
              effectiveHospitalId={hospitalId}
              patients={patients}
              selectedPatient={selectedPatient}
              activeOpdVisit={activeOpdVisit}
              employees={employeesList}
              onOpenPatient={handleOpenPatientProfile}
            />
          </div>
        )}

        {/* Tab 7: Operational Reports */}
        {activeTab === "reports" && enabledModules.includes("REPORTS") && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#151917]">Operational Logs & Reports</h2>
              <p className="text-sm text-[#626a62] mt-1">
                View hospital activity logs, audits, and real-time registry statistics.
              </p>
            </div>

            {/* Stats Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#dfe4d9] rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#626a62]">Total Patients</p>
                  <h3 className="text-2xl font-black text-[#2f5d50] mt-1">{patientPagination.total}</h3>
                </div>
                <p className="text-[10px] text-[#626a62] mt-2">Registered in directory</p>
              </div>

              <div className="bg-white border border-[#dfe4d9] rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#626a62]">Appointments today</p>
                  <h3 className="text-2xl font-black text-[#2f5d50] mt-1">{todayAppointments.length}</h3>
                </div>
                <p className="text-[10px] text-[#626a62] mt-2">Lined up in consultation queue</p>
              </div>

              <div className="bg-white border border-[#dfe4d9] rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#626a62]">Scheduled Books</p>
                  <h3 className="text-2xl font-black text-[#2f5d50] mt-1">{appointmentPagination.total}</h3>
                </div>
                <p className="text-[10px] text-[#626a62] mt-2">All-time appointments booked</p>
              </div>

              <div className="bg-white border border-[#dfe4d9] rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#626a62]">Hospital Workspace</p>
                  <h3 className="text-sm font-black text-[#2f5d50] mt-1 truncate">{hospitalName || "Medflow Facility"}</h3>
                </div>
                <p className="text-[10px] text-[#626a62] mt-2">Status: Active Subscription</p>
              </div>
            </div>

            {/* Sub-tab navigation */}
            <div className="flex border-b border-[#dfe4d9] gap-4 mb-6">
              {[
                { id: "patients", label: "Patient Directory Stats" },
                { id: "opd", label: "OPD Consultation Stats" },
                { id: "ipd", label: "IPD Occupancy Stats (Simulated)" }
              ].map((subTab) => (
                <button
                  key={subTab.id}
                  onClick={() => setReportsSubTab(subTab.id as any)}
                  className={`pb-2 text-sm font-semibold transition border-b-2 ${
                    reportsSubTab === subTab.id
                      ? "border-[#2f5d50] text-[#2f5d50]"
                      : "border-transparent text-[#626a62] hover:text-[#20231f]"
                  }`}
                >
                  {subTab.label}
                </button>
              ))}
            </div>

            {reportsSubTab === "patients" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Surface title="Patient Demographics Analysis">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-[#f3f5f0] pb-2 text-xs">
                        <span className="text-[#626a62] font-semibold">Total Registered</span>
                        <span className="font-bold text-[#20231f]">{patientPagination.total}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#f3f5f0] pb-2 text-xs">
                        <span className="text-[#626a62] font-semibold">Male Patients (Simulated)</span>
                        <span className="font-bold text-[#20231f]">{Math.round(patientPagination.total * 0.54)} (54%)</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#f3f5f0] pb-2 text-xs">
                        <span className="text-[#626a62] font-semibold">Female Patients (Simulated)</span>
                        <span className="font-bold text-[#20231f]">{Math.round(patientPagination.total * 0.45)} (45%)</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 text-xs">
                        <span className="text-[#626a62] font-semibold">Other/Unspecified</span>
                        <span className="font-bold text-[#20231f]">{Math.round(patientPagination.total * 0.01)} (1%)</span>
                      </div>
                    </div>
                  </Surface>

                  <Surface title="Recent Patient Registrations" description="Listing recently registered patients in the database.">
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {patients.slice(0, 5).map((p) => (
                        <div key={p.id} className="p-3 border border-[#d8ddd3] bg-white rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-[#2f5d50]">{p.patientCode}</p>
                            <p className="font-semibold text-[#20231f] mt-0.5">{[p.firstName, p.lastName].filter(Boolean).join(" ")}</p>
                            <p className="text-[10px] text-[#626a62] mt-0.5">Phone: {p.phone || "N/A"} • Gender: {p.gender}</p>
                          </div>
                          <span className="text-[#626a62] text-[10px]">Active</span>
                        </div>
                      ))}
                      {patients.length === 0 && (
                        <p className="text-xs text-[#626a62] italic text-center py-4">No patient records available.</p>
                      )}
                    </div>
                  </Surface>
                </div>
              </div>
            )}

            {reportsSubTab === "opd" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Surface title="Today's OPD Queue Metrics">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-[#f3f5f0] pb-2 text-xs">
                        <span className="text-[#626a62] font-semibold">Total Queue Load</span>
                        <span className="font-bold text-[#20231f]">{todayAppointments.length}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#f3f5f0] pb-2 text-xs">
                        <span className="text-[#626a62] font-semibold">Completed Consultations</span>
                        <span className="font-bold text-green-700">{todayAppointments.filter(a => a.status === "COMPLETED").length}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#f3f5f0] pb-2 text-xs">
                        <span className="text-[#626a62] font-semibold">Active in Consultation</span>
                        <span className="font-bold text-blue-700">{todayAppointments.filter(a => a.status === "IN_CONSULTATION").length}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 text-xs">
                        <span className="text-[#626a62] font-semibold">Waiting / Checked In</span>
                        <span className="font-bold text-amber-700">{todayAppointments.filter(a => a.status === "CHECKED_IN" || a.status === "SCHEDULED").length}</span>
                      </div>
                    </div>
                  </Surface>

                  <Surface title="Consultation Stats By Doctor" description="Appointments breakdown per doctor on roster.">
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {doctorsList.map((doc) => {
                        const count = todayAppointments.filter(a => a.doctor?.id === doc.id).length;
                        const completed = todayAppointments.filter(a => a.doctor?.id === doc.id && a.status === "COMPLETED").length;
                        return (
                          <div key={doc.id} className="p-3 border border-[#d8ddd3] bg-white rounded-lg flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-[#20231f]">{doc.fullName}</p>
                              <p className="text-[10px] text-[#626a62] mt-0.5">Dept: {doc.department || "General Medicine"}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-[#2f5d50]">{count} Appts</p>
                              <p className="text-[10px] text-green-700 mt-0.5">{completed} Done</p>
                            </div>
                          </div>
                        );
                      })}
                      {doctorsList.length === 0 && (
                        <p className="text-xs text-[#626a62] italic text-center py-4">No doctors registered in the system.</p>
                      )}
                    </div>
                  </Surface>
                </div>
              </div>
            )}

            {reportsSubTab === "ipd" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "Total IPD Beds", val: 50, color: "text-[#2f5d50]" },
                    { label: "Occupied Beds", val: 34, color: "text-amber-700" },
                    { label: "Occupancy Rate", val: "68%", color: "text-blue-700" },
                  ].map((card, idx) => (
                    <div key={idx} className="bg-white border border-[#dfe4d9] rounded-xl p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#626a62]">{card.label}</p>
                      <h3 className={`text-2xl font-black mt-1 ${card.color}`}>{card.val}</h3>
                    </div>
                  ))}
                </div>

                <Surface title="Simulated Active IPD Admitted Cases" description="Current active inpatients in ward.">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f3f5f0] text-xs uppercase tracking-wider text-[#626a62]">
                        <tr>
                          <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">IPD No</th>
                          <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Patient</th>
                          <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Ward/Bed</th>
                          <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Admission Date</th>
                          <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Admitting Doctor</th>
                          <th className="px-4 py-3 font-semibold border-b border-[#dfe4d9]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { ipdNo: "IPD-2026-001", name: "Aarav Mehta", bed: "Ward A - Bed 12", date: "2026-06-08", doctor: "Dr. Ramesh Patel", status: "ADMITTED" },
                          { ipdNo: "IPD-2026-002", name: "Priya Sharma", bed: "Ward B - Bed 04", date: "2026-06-09", doctor: "Dr. Anjali Gupta", status: "ADMITTED" },
                          { ipdNo: "IPD-2026-003", name: "Vikram Singh", bed: "ICU - Bed 02", date: "2026-06-10", doctor: "Dr. Rajesh Sharma", status: "CRITICAL" },
                          { ipdNo: "IPD-2026-004", name: "Neha Verma", bed: "Ward A - Bed 09", date: "2026-06-11", doctor: "Dr. Ramesh Patel", status: "ADMITTED" },
                          { ipdNo: "IPD-2026-005", name: "Kabir Roy", bed: "Ward C - Bed 15", date: "2026-06-11", doctor: "Dr. Anjali Gupta", status: "STABLE" }
                        ].map((c, idx) => (
                          <tr key={idx} className="border-b border-[#edf0e9] hover:bg-[#fcfdfc] transition">
                            <td className="px-4 py-3 font-bold text-[#2f5d50]">{c.ipdNo}</td>
                            <td className="px-4 py-3 font-semibold text-[#20231f]">{c.name}</td>
                            <td className="px-4 py-3 font-mono">{c.bed}</td>
                            <td className="px-4 py-3">{new Date(c.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3">{c.doctor}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                c.status === "CRITICAL" ? "bg-red-100 text-red-800" :
                                c.status === "STABLE" ? "bg-green-100 text-green-800" :
                                "bg-blue-100 text-blue-800"
                              }`}>
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Surface>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
