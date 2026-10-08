import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Building2,
  FileCheck2,
  Lock,
  Cpu,
  ArrowRight,
  ExternalLink,
  Award,
  } from "lucide-react";
import { useContract } from "../hooks/useContract";
import { truncateAddress } from "../lib/crypto";

export const LandingPage: React.FC = () => {
  const { contractAddress, sampleCertificates } = useContract();

  return (
    <div className="space-y-24 py-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden text-center max-w-4xl mx-auto px-4">
        {/* Glow decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-8">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          <span>Ethereum Secured & IPFS Anchored Credentials</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
          Decentralized Academic <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
            Credential Verification
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Universities issue tamper-proof digital diplomas. Documents reside permanently on IPFS while their cryptographic SHA-256 hashes are immutable on Ethereum. Instant zero-login verification for employers.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/verify"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            <ShieldCheck className="w-5 h-5" />
            Verify a Certificate
          </Link>

          <Link
            to="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-base shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            <Building2 className="w-5 h-5 text-indigo-500" />
            I'm an Institution
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Live contract indicator */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
          <span>Contract:</span>
          <span className="bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-semibold">
            {truncateAddress(contractAddress, 6)}
          </span>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Zero Login Required</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Employers and recruiters can instantly verify credentials by dragging and dropping the original PDF, entering the certificate ID, or querying a student wallet.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-6">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Privacy Preserving</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              No personally identifiable information (PII) is placed unencrypted on Ethereum. Only immutable SHA-256 and cryptographic keccak256 metadata commitments are stored on-chain.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-6">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Decentralized & Tamper-Proof</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Decentralized storage on IPFS combined with Ethereum smart contract authorization guarantees lifelong, tamper-evident availability that never relies on a single proprietary vendor.
            </p>
          </div>
        </div>
      </section>

      {/* Pre-seeded Demo Credentials Showcase */}
      {sampleCertificates && sampleCertificates.length > 0 && (
        <section className="max-w-5xl mx-auto px-4">
          <div className="rounded-3xl bg-gradient-to-b from-slate-100 to-white dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-8 sm:p-10 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Ready-to-Test Demo
                </span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  Pre-Seeded Sample Certificates
                </h3>
              </div>
              <span className="px-3 py-1 text-xs rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-semibold">
                Massachusetts Institute of Technology
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sampleCertificates.map((cert: any, idx: number) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Degree</span>
                      <Award className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white text-base">
                      {cert.metadata?.degree}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {cert.metadata?.program}
                    </div>
                    <div className="text-xs text-slate-500">
                      Student: <span className="font-semibold text-slate-700 dark:text-slate-300">{cert.metadata?.studentName}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-500">
                      ID: {truncateAddress(cert.id, 4)}
                    </span>
                    <Link
                      to={`/verify/${cert.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Instant Verify
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Verification Architecture Workflow */}
      <section className="max-w-5xl mx-auto px-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">
          How Verification Works
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base mb-12">
          From diploma issuance to instant employer verification in three deterministic steps.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
              1
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Document Pinning</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              University uploads the official diploma PDF. The server calculates a deterministic SHA-256 digest and pins the file to IPFS.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
              2
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Blockchain Anchoring</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              The university�s authorized wallet invokes <code className="text-blue-500 font-mono">issueCertificate()</code> on Ethereum, permanently binding the IPFS CID, docHash, and recipient address.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
              3
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Client-Side Verification</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Employers drag-and-drop the PDF. The browser hashes the bytes locally with Web Crypto API and queries the smart contract directly.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
