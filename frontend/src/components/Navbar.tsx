import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  GraduationCap,
  ShieldCheck,
  Building2,
  Lock,
  Sun,
  Moon,
  Wallet,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useContract, INSTITUTION_ROLE, DEFAULT_ADMIN_ROLE } from "../hooks/useContract";
import { truncateAddress } from "../lib/crypto";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { account, chainId, connect, disconnect, isConnecting, switchNetwork } = useWallet();
  const { readContract } = useContract();

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  const [hasInstitutionRole, setHasInstitutionRole] = useState(false);
  const [hasAdminRole, setHasAdminRole] = useState(false);
  const [institutionName, setInstitutionName] = useState("");

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Check roles
  useEffect(() => {
    if (!account || !readContract) {
      setHasInstitutionRole(false);
      setHasAdminRole(false);
      setInstitutionName("");
      return;
    }

    let isMounted = true;
    async function checkRoles() {
      try {
        const [isInst, isAdmin] = await Promise.all([
          readContract.hasRole(INSTITUTION_ROLE, account),
          readContract.hasRole(DEFAULT_ADMIN_ROLE, account),
        ]);
        if (isMounted) {
          setHasInstitutionRole(isInst);
          setHasAdminRole(isAdmin);
          if (isInst) {
            const name = await readContract.institutionNames(account);
            setInstitutionName(name);
          }
        }
      } catch (err) {
        console.warn("Failed checking roles:", err);
      }
    }
    checkRoles();
    return () => {
      isMounted = false;
    };
  }, [account, readContract]);

  const isWrongNetwork = chainId && chainId !== "0x7a69" && chainId !== "0xaa36a7";

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                VeriCred
              </span>
              <span className="hidden sm:inline-block ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded">
                Ethereum
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/verify"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                location.pathname.startsWith("/verify")
                  ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Verify Certificate
            </Link>

            <Link
              to="/dashboard"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                location.pathname === "/dashboard"
                  ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Building2 className="w-4 h-4" />
              University Portal
              {hasInstitutionRole && (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </Link>

            <Link
              to="/admin"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                location.pathname === "/admin"
                  ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Lock className="w-4 h-4" />
              Admin
              {hasAdminRole && (
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              )}
            </Link>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Network switch prompt if wrong network */}
            {isWrongNetwork && (
              <button
                onClick={() => switchNetwork("localhost")}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                Switch to Localhost
              </button>
            )}

            {/* Wallet Connect / Pill */}
            {account ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{truncateAddress(account)}</span>
                  </div>
                  {institutionName && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate max-w-[120px]">
                      {institutionName}
                    </span>
                  )}
                </div>
                <button
                  onClick={disconnect}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Disconnect Wallet"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
