"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  message: string;
};

type AuthUser = {
  id: string;
  username: string;
  userType: string;
  hospitalId: string | null;
};

type HospitalItem = {
  id: string;
  name: string;
  subdomain: string;
  logo: string | null;
  loginImage1: string | null;
  loginImage2: string | null;
  loginImage3: string | null;
};

// Default premium clinical background images for the carousel
const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80", // Lobby
  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80", // Consultation
  "https://images.unsplash.com/photo-1579154767074-48b5935040f2?auto=format&fit=crop&w=1200&q=80", // Lab
];

// Helper to extract subdomain from hostname
function getTenantSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  const parts = hostname.split(".");

  // 1. Localhost handling
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    if (parts.length === 2) {
      const sub = parts[0].toLowerCase();
      if (sub !== "www" && sub !== "admin") return sub;
    }
    return null;
  }

  // 2. Check if we are on a Vercel or Netlify default deployment domain
  const isVercel = hostname.endsWith(".vercel.app");
  const isNetlify = hostname.endsWith(".netlify.app");

  if (isVercel || isNetlify) {
    // For project-name.vercel.app (3 parts), this is the apex, so no tenant.
    // Tenant subdomains will have 4 or more parts (e.g. tenant-name.project-name.vercel.app).
    if (parts.length >= 4) {
      const sub = parts[0].toLowerCase();
      if (sub !== "www" && sub !== "admin" && sub !== "api" && sub !== "app") {
        return sub;
      }
    }
    return null;
  }

  // 3. Custom domain (e.g. city-hospital.medflow.com)
  if (parts.length >= 3) {
    if (parts[0].toLowerCase() === "www") {
      return null;
    }
    const sub = parts[0].toLowerCase();
    if (sub !== "admin" && sub !== "api" && sub !== "app") {
      return sub;
    }
  }

  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Subdomain / Facility routing states
  const [isSuperAdminPortal, setIsSuperAdminPortal] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState("");
  const [resolvedHospital, setResolvedHospital] = useState<HospitalItem | null>(null);
  const [isSubdomainLocked, setIsSubdomainLocked] = useState(false);
  const [isSearchingSubdomain, setIsSearchingSubdomain] = useState(false);
  const [subdomainError, setSubdomainError] = useState("");

  // Fading slideshow active image index state
  const [carouselIndex, setCarouselIndex] = useState(0);

  // 1. Detect Subdomain from URL on mount
  useEffect(() => {
    const sub = getTenantSubdomain();
    if (sub) {
      setIsSubdomainLocked(true);
      setSubdomainInput(sub);
      lookupSubdomain(sub);
    }
  }, []);

  // 2. Automated background image slideshow interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % 3);
    }, 5000); // Shift image every 5 seconds
    return () => clearInterval(timer);
  }, []);

  // Lookup hospital by subdomain prefix
  const lookupSubdomain = async (sub: string) => {
    if (!sub.trim()) return;
    setIsSearchingSubdomain(true);
    setSubdomainError("");
    setResolvedHospital(null);
    try {
      const res = await fetch(`/api/auth/hospitals?subdomain=${sub.trim().toLowerCase()}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setResolvedHospital(data.data[0]);
      } else {
        setSubdomainError("Facility workspace not found. Check the subdomain spelling.");
      }
    } catch (err) {
      console.error(err);
      setSubdomainError("Connection failed trying to resolve workspace.");
    } finally {
      setIsSearchingSubdomain(false);
    }
  };

  // Determine images to cycle through
  const getCarouselImages = () => {
    if (isSuperAdminPortal) {
      return DEFAULT_IMAGES; // Default corporate medical images for platform owner
    }
    return [
      resolvedHospital?.loginImage1 || DEFAULT_IMAGES[0],
      resolvedHospital?.loginImage2 || DEFAULT_IMAGES[1],
      resolvedHospital?.loginImage3 || DEFAULT_IMAGES[2],
    ];
  };

  const activeImages = getCarouselImages();

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const result = (await response.json()) as
        | ApiSuccess<{
            token: string;
            user: AuthUser;
          }>
        | ApiFailure;

      if (!result.success) {
        setLoginError(result.message);
        setIsLoggingIn(false);
        return;
      }

      // Save auth tokens
      window.localStorage.setItem("hospital_token", result.data.token);
      window.localStorage.setItem("hospital_user", JSON.stringify(result.data.user));

      // Now fetch detailed roles to redirect
      const meResponse = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${result.data.token}`,
        },
      });
      const meResult = await meResponse.json();

      if (meResult.success) {
        const fullUser = meResult.data.user;
        window.localStorage.setItem("hospital_user", JSON.stringify(fullUser));

        if (fullUser.userType === "SUPER_ADMIN") {
          router.push("/super-admin");
        } else {
          // Check if user is a Hospital Admin
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
        // Fallback redirection
        if (result.data.user.userType === "SUPER_ADMIN") {
          router.push("/super-admin");
        } else {
          router.push("/employee");
        }
      }
    } catch (err) {
      console.error(err);
      setLoginError("Connection failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] flex flex-col md:flex-row text-[#20231f]">
      {/* Left Column: Fading Carousel + Hospital Branding */}
      <section className="flex-1 bg-[#12221b] text-white p-8 md:p-16 flex flex-col justify-between relative overflow-hidden md:max-w-[50%] lg:max-w-[60%] min-h-[350px] md:min-h-screen">
        
        {/* Background Image Carousel with absolute positioning & opacity transitions */}
        <div className="absolute inset-0 z-0">
          {activeImages.map((imgUrl, index) => (
            <div
              key={index}
              style={{ backgroundImage: `url(${imgUrl})` }}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
                index === carouselIndex ? "opacity-30" : "opacity-0"
              }`}
            />
          ))}
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#12221b] via-[#12221b]/80 to-transparent" />
        </div>

        {/* Top brand signature */}
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8fbc8f]">
            MedFlow SaaS Platform
          </p>
        </div>

        {/* Dynamic Center Branding section */}
        <div className="my-auto relative z-10 max-w-xl space-y-6 pt-12 md:pt-0">
          {/* Logo display */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl w-fit border border-white/10 shadow-lg">
            {isSuperAdminPortal ? (
              // MedFlow SaaS Logo
              <svg viewBox="0 0 100 100" className="w-16 h-16 text-[#8fbc8f]" fill="none" stroke="currentColor">
                <circle cx="50" cy="50" r="44" strokeWidth="4" className="opacity-30" />
                <path d="M50 25 V75 M25 50 H75" strokeWidth="10" strokeLinecap="round" />
                <path d="M30 72 C40 64 45 74 55 66 C65 58 70 70 80 62" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : resolvedHospital?.logo ? (
              // Hospital custom logo
              <img
                src={resolvedHospital.logo}
                alt={resolvedHospital.name}
                className="w-16 h-16 object-contain rounded-lg"
              />
            ) : (
              // Default Hospital Shield Logo
              <svg viewBox="0 0 100 100" className="w-16 h-16 text-[#34d399]" fill="none" stroke="currentColor">
                <path d="M50 12 C68 12 78 18 78 32 C78 58 50 84 50 84 C50 84 22 58 22 32 C22 18 32 12 50 12 Z" strokeWidth="4" strokeLinejoin="round" />
                <path d="M50 32 V62 M35 47 H65" strokeWidth="8" strokeLinecap="round" />
              </svg>
            )}
          </div>

          {/* Large Title */}
          <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white drop-shadow-sm">
            {isSuperAdminPortal
              ? "MedFlow Platform Control"
              : resolvedHospital
              ? resolvedHospital.name
              : "Access Your Facility Workspace"}
          </h1>

          <p className="text-sm lg:text-base text-[#bfd7c9] leading-relaxed max-w-md drop-shadow-sm">
            {isSuperAdminPortal
              ? "Access the system-wide platform dashboard to create hospital tenants, manage global subscriptions, toggle SaaS operational modules, and review audit trails."
              : resolvedHospital
              ? "Welcome to the facility portal. Log in to access the Clinical Registry, OP/IP Operations, Radiology/Lab Workbenches, Financial Bills, and Admin settings."
              : "Enter your login credentials below to access your workspace directly, or resolve your custom subdomain workspace to customize your brand branding."}
          </p>
        </div>

        {/* Footer trademark info */}
        <div className="relative z-10 text-xs text-[#6e8a7c] mt-8 md:mt-0">
          © {new Date().getFullYear()} MedFlow SaaS Inc. All rights reserved.
        </div>
      </section>

      {/* Right Column: Portal Workspace & Credentials Login form */}
      <section className="w-full md:w-[50%] lg:w-[40%] px-8 py-12 md:p-16 flex flex-col justify-center bg-white">
        <div className="w-full max-w-sm mx-auto space-y-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#151917]">
              Account Authentication
            </h2>
            <p className="text-xs text-[#626a62] mt-1.5">
              Securely authenticate to access your facility portal.
            </p>
          </div>

          {/* Selector Tabs: Hospital Portal vs SaaS Platform Owner */}
          {!isSubdomainLocked && (
            <div className="flex border-b border-[#dfe4d9]">
              <button
                type="button"
                onClick={() => {
                  setIsSuperAdminPortal(false);
                  setLoginError("");
                }}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
                  !isSuperAdminPortal
                    ? "border-[#2f5d50] text-[#2f5d50]"
                    : "border-transparent text-[#626a62] hover:text-[#20231f]"
                }`}
              >
                Hospital Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSuperAdminPortal(true);
                  setLoginError("");
                  setResolvedHospital(null);
                  setSubdomainInput("");
                  setSubdomainError("");
                }}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
                  isSuperAdminPortal
                    ? "border-[#2f5d50] text-[#2f5d50]"
                    : "border-transparent text-[#626a62] hover:text-[#20231f]"
                }`}
              >
                Platform Owner (Super)
              </button>
            </div>
          )}

          {/* Subdomain entry (Only for Hospital view, if not locked by URL hostname) */}
          {!isSuperAdminPortal && !isSubdomainLocked && (
            <div className="space-y-2">
              <label htmlFor="subdomain" className="block text-xs font-bold uppercase tracking-wider text-[#626a62]">
                Hospital Subdomain / Prefix
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="subdomain"
                    type="text"
                    value={subdomainInput}
                    onChange={(e) => {
                      setSubdomainInput(e.target.value);
                      setSubdomainError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        lookupSubdomain(subdomainInput);
                      }
                    }}
                    className="block w-full h-11 rounded-md border border-[#cfd6ca] bg-white px-3 py-2 text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
                    placeholder="e.g. city-hospital"
                  />
                  <span className="absolute right-3 top-3 text-xs text-[#a0a59e]">.medflow.com</span>
                </div>
                <button
                  type="button"
                  onClick={() => lookupSubdomain(subdomainInput)}
                  disabled={isSearchingSubdomain || !subdomainInput.trim()}
                  className="h-11 px-4 text-xs font-bold bg-[#eef3eb] text-[#2f5d50] hover:bg-[#e4ebde] border border-[#d8ddd3] rounded-md transition disabled:opacity-60"
                >
                  {isSearchingSubdomain ? "Searching..." : "Resolve"}
                </button>
              </div>

              {subdomainError && (
                <p className="text-xs text-[#9f2d24] font-medium">{subdomainError}</p>
              )}
            </div>
          )}

          {/* Subdomain locked indicator (if subdomain matches hostname URL or is resolved) */}
          {((isSubdomainLocked && resolvedHospital) || resolvedHospital) && !isSuperAdminPortal && (
            <div className="bg-[#f3f5f0] border border-[#d8ddd3] rounded-lg p-3 text-xs text-[#2f5d50] flex items-center justify-between">
              <div>
                <span className="font-bold">Hospital Workspace:</span> {resolvedHospital.name}
              </div>
              <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded">
                {isSubdomainLocked ? "Locked URL" : "Resolved"}
              </span>
            </div>
          )}

          {/* Credentials Inputs (Always Rendered) */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-[#626a62]">
                Username
              </label>
              <div className="mt-2">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full h-11 rounded-md border border-[#cfd6ca] bg-white px-3 py-2 text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
                  placeholder={isSuperAdminPortal ? "Enter admin username" : resolvedHospital ? `Username for ${resolvedHospital.name}` : "Enter your username"}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[#626a62]">
                Password
              </label>
              <div className="mt-2 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full h-11 rounded-md border border-[#cfd6ca] bg-white pl-3 pr-10 py-2 text-sm outline-none focus:border-[#477063] focus:ring-2 focus:ring-[#477063]/20 transition"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#626a62] hover:text-[#20231f] focus:outline-none"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error messaging */}
            {loginError && (
              <div className="rounded-md bg-[#fff0ef] p-3 text-xs text-[#9f2d24] border border-[#fcdad7]">
                {loginError}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-11 flex justify-center items-center rounded-md text-sm font-semibold text-white bg-[#2f5d50] hover:bg-[#24483e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#477063] disabled:cursor-not-allowed disabled:opacity-60 transition gap-2"
              >
                {isLoggingIn && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isLoggingIn ? "Authenticating Session..." : "Secure Sign In"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
