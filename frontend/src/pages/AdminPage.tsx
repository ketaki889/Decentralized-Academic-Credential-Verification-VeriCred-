import React, { useState, useEffect } from "react";
import {
  Lock,
    UserCheck,
  UserX,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useContract, DEFAULT_ADMIN_ROLE } from "../hooks/useContract";
import { truncateAddress } from "../lib/crypto";

export const AdminPage: React.FC = () => {
  const { account, signer, connect } = useWallet();
  const { readContract, writeContract } = useContract(signer);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [instAddress, setInstAddress] = useState("");
  const [instName, setInstName] = useState("");
  const [revokeAddress, setRevokeAddress] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Check DEFAULT_ADMIN_ROLE
  useEffect(() => {
    if (!account || !readContract) {
      setIsAdmin(false);
      return;
    }

    let isMounted = true;
    async function checkAdmin() {
      try {
        const hasAdmin = await readContract.hasRole(DEFAULT_ADMIN_ROLE, account);
        if (isMounted) setIsAdmin(hasAdmin);
      } catch (err) {
        if (isMounted) setIsAdmin(false);
      }
    }
    checkAdmin();
    return () => {
      isMounted = false;
    };
  }, [account, readContract]);

  // Authorize institution
  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instAddress || !instName || !writeContract) return;

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const tx = await writeContract.authorizeInstitution(instAddress, instName);
      await tx.wait();
      setActionSuccess(`Successfully authorized ${instName} (${truncateAddress(instAddress)})`);
      setInstAddress("");
      setInstName("");
    } catch (err: any) {
      console.error(err);
      setActionError(err.reason || err.message || "Failed to authorize institution.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revoke institution
  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeAddress || !writeContract) return;

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const tx = await writeContract.revokeInstitution(revokeAddress);
      await tx.wait();
      setActionSuccess(`Successfully revoked issuing rights for ${truncateAddress(revokeAddress)}`);
      setRevokeAddress("");
    } catch (err: any) {
      console.error(err);
      setActionError(err.reason || err.message || "Failed to revoke institution.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Console</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Please connect your MetaMask wallet with contract administrator privileges (DEFAULT_ADMIN_ROLE).
        </p>
        <button
          onClick={connect}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          Connect Admin Wallet
        </button>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Rights Required</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Connected account <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{account}</span> is not registered as the DEFAULT_ADMIN_ROLE deployer of this CredentialRegistry contract.
        </p>
        <p className="text-xs text-slate-500">
          Tip: In local dev, Account #0 (0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266) is the deployer admin.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      <div className="p-8 rounded-3xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white shadow-xl flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider font-semibold text-purple-300 flex items-center gap-1.5">
            <Lock className="w-4 h-4" />
            Platform Governance
          </span>
          <h1 className="text-3xl font-extrabold">Registry Admin Portal</h1>
          <p className="text-xs font-mono text-purple-200">Admin: {account}</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold">
          DEFAULT_ADMIN_ROLE
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Authorize Institution */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Authorize University</h2>
          </div>
          <p className="text-xs text-slate-500">
            Grant INSTITUTION_ROLE to an accredited institution address allowing certificate issuance.
          </p>

          <form onSubmit={handleAuthorize} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Institution Ethereum Address
              </label>
              <input
                type="text"
                required
                placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                value={instAddress}
                onChange={(e) => setInstAddress(e.target.value.trim())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Institution Legal Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Oxford University"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Authorize Institution
            </button>
          </form>
        </div>

        {/* Revoke Institution */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Revoke University Authority</h2>
          </div>
          <p className="text-xs text-slate-500">
            Revoke INSTITUTION_ROLE from an institution. Any existing certificates issued by them will fail future validations.
          </p>

          <form onSubmit={handleRevoke} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Institution Ethereum Address
              </label>
              <input
                type="text"
                required
                placeholder="0x..."
                value={revokeAddress}
                onChange={(e) => setRevokeAddress(e.target.value.trim())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div className="pt-8">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                Revoke Authority
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
