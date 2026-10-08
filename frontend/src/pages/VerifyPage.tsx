import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  UploadCloud,
  FileText,
  User,
  Building2,
  Calendar,
  ExternalLink,
  Copy,
  Check,
    AlertTriangle,
  Loader2,
  Share2,
} from "lucide-react";
import { useContract } from "../hooks/useContract";
import { computeSha256, truncateAddress, formatDate } from "../lib/crypto";
import { getApiUrl } from "../lib/api";

interface VerificationResult {
  cert: {
    id: string;
    institution: string;
    student: string;
    ipfsCid: string;
    docHash: string;
    metadataHash: string;
    issuedAt: number;
    revoked: boolean;
  };
  institutionName: string;
  isValid: boolean;
  metadata?: {
    studentName?: string;
    degree?: string;
    program?: string;
    graduationDate?: string;
  };
}

export const VerifyPage: React.FC = () => {
  const { id: routeCertId } = useParams<{ id?: string }>();
    const { readContract, sampleCertificates } = useContract();

  const [activeTab, setActiveTab] = useState<"id" | "file" | "student">("id");
  const [certIdInput, setCertIdInput] = useState<string>(routeCertId || "");
  const [studentInput, setStudentInput] = useState<string>("");
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [studentCerts, setStudentCerts] = useState<string[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Fetch certificate metadata from IPFS gateway if available
  const fetchMetadata = async (cid: string) => {
    try {
      // Find from sample seed or fetch via IPFS
      const sample = sampleCertificates.find((s: any) => s.cid === cid);
      if (sample && sample.metadata) return sample.metadata;

      const res = await fetch(getApiUrl(`/api/ipfs/${cid}`));
      if (res.ok) {
        const json = await res.json();
        return json;
      }
    } catch (e) {
      console.warn("Could not fetch metadata from IPFS:", e);
    }
    return undefined;
  };

  // Perform verification by ID
  const verifyById = useCallback(
    async (idToVerify: string) => {
      if (!idToVerify || !readContract) return;
      setIsLoading(true);
      setErrorMsg(null);
      setVerificationResult(null);

      try {
        const [cert, institutionName, valid] = await readContract.verifyCertificate(idToVerify);
        if (cert.issuedAt === 0n || cert.issuedAt === 0) {
          setErrorMsg("No certificate record was found matching this identifier on the Ethereum ledger.");
          setIsLoading(false);
          return;
        }

        const metadata = await fetchMetadata(cert.ipfsCid);

        setVerificationResult({
          cert: {
            id: cert.id,
            institution: cert.institution,
            student: cert.student,
            ipfsCid: cert.ipfsCid,
            docHash: cert.docHash,
            metadataHash: cert.metadataHash,
            issuedAt: Number(cert.issuedAt),
            revoked: Boolean(cert.revoked),
          },
          institutionName,
          isValid: Boolean(valid),
          metadata,
        });
      } catch (err: any) {
        console.error("Verification failed:", err);
        setErrorMsg("Failed to query Ethereum contract. Please ensure local node is accessible.");
      } finally {
        setIsLoading(false);
      }
    },
    [readContract]
  );

  // Perform verification by SHA-256 Hash
  const verifyByHash = useCallback(
    async (hashToVerify: string) => {
      if (!hashToVerify || !readContract) return;
      setIsLoading(true);
      setErrorMsg(null);
      setVerificationResult(null);

      try {
        const [cert, institutionName, valid] = await readContract.verifyByHash(hashToVerify);
        if (cert.issuedAt === 0n || cert.issuedAt === 0) {
          setErrorMsg(
            "Document hash was not found. This PDF file has either been altered or was never registered."
          );
          setIsLoading(false);
          return;
        }

        const metadata = await fetchMetadata(cert.ipfsCid);

        setVerificationResult({
          cert: {
            id: cert.id,
            institution: cert.institution,
            student: cert.student,
            ipfsCid: cert.ipfsCid,
            docHash: cert.docHash,
            metadataHash: cert.metadataHash,
            issuedAt: Number(cert.issuedAt),
            revoked: Boolean(cert.revoked),
          },
          institutionName,
          isValid: Boolean(valid),
          metadata,
        });
      } catch (err: any) {
        console.error("Verification by hash failed:", err);
        setErrorMsg("Failed to query Ethereum contract. Please check RPC connection.");
      } finally {
        setIsLoading(false);
      }
    },
    [readContract]
  );

  // Search certificates by student address
  const handleStudentSearch = async () => {
    if (!studentInput || !readContract) return;
    setIsLoading(true);
    setErrorMsg(null);
    setStudentCerts([]);

    try {
      const ids = await readContract.getCertificatesByStudent(studentInput);
      if (!ids || ids.length === 0) {
        setErrorMsg(`No certificates found for student wallet: ${studentInput}`);
      } else {
        setStudentCerts(ids);
      }
    } catch (err: any) {
      setErrorMsg("Failed to query student credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file drop & client-side hashing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | DragEvent) => {
    let file: File | null = null;
    if ("dataTransfer" in e && e.dataTransfer) {
      file = e.dataTransfer.files[0];
    } else if ("target" in e && e.target) {
      file = (e.target as HTMLInputElement).files?.[0] || null;
    }

    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Please upload a PDF document (.pdf)");
      return;
    }

    setFileName(file.name);
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Web Crypto API browser-side hash computation
      const calculatedHash = await computeSha256(arrayBuffer);
      setFileHash(calculatedHash);
      await verifyByHash(calculatedHash);
    } catch (err: any) {
      setErrorMsg("Failed to compute document hash in browser.");
      setIsLoading(false);
    }
  };

  // Trigger verify if route param exists
  useEffect(() => {
    if (routeCertId) {
      setCertIdInput(routeCertId);
      setActiveTab("id");
      verifyById(routeCertId);
    }
  }, [routeCertId, verifyById]);

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">
          Certificate Verification
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
          Verify academic credentials directly against Ethereum without requiring an account or wallet.
        </p>
      </div>

      {/* Input Options Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <button
            onClick={() => {
              setActiveTab("id");
              setErrorMsg(null);
            }}
            className={`flex-1 py-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === "id"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Search className="w-4 h-4" />
            Certificate ID
          </button>
          <button
            onClick={() => {
              setActiveTab("file");
              setErrorMsg(null);
            }}
            className={`flex-1 py-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === "file"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Drag & Drop PDF
          </button>
          <button
            onClick={() => {
              setActiveTab("student");
              setErrorMsg(null);
            }}
            className={`flex-1 py-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === "student"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <User className="w-4 h-4" />
            Student Wallet
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* Tab 1: Certificate ID */}
          {activeTab === "id" && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Enter Certificate Hex Identifier (bytes32)
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="0x2706fffad96ee0e65c8a3dd60658451ffbca86cb2103198e2cf8678ec36e9b2f"
                  value={certIdInput}
                  onChange={(e) => setCertIdInput(e.target.value.trim())}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button
                  onClick={() => verifyById(certIdInput)}
                  disabled={!certIdInput || isLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Verify
                </button>
              </div>

              {/* Quick sample ID buttons */}
              {sampleCertificates.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Quick Test Samples:</span>
                  {sampleCertificates.map((s: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCertIdInput(s.id);
                        verifyById(s.id);
                      }}
                      className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      Sample #{idx + 1} ({s.metadata?.studentName})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: File Drop */}
          {activeTab === "file" && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Upload or Drop Official Diploma PDF
              </label>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(e as any);
                }}
                className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-800/40 group"
              >
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      Drag & Drop your diploma PDF here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Computed client-side with Web Crypto SHA-256 without sending files over the network
                    </p>
                  </div>
                </div>
              </div>

              {fileName && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs font-mono">
                  <span className="truncate max-w-xs">{fileName}</span>
                  {fileHash && <span className="text-blue-500">{truncateAddress(fileHash, 6)}</span>}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Student Address */}
          {activeTab === "student" && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Search by Student Ethereum Address
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
                  value={studentInput}
                  onChange={(e) => setStudentInput(e.target.value.trim())}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button
                  onClick={handleStudentSearch}
                  disabled={!studentInput || isLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Find
                </button>
              </div>

              {/* Quick sample student buttons */}
              {sampleCertificates.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Demo Students:</span>
                  {sampleCertificates.map((s: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setStudentInput(s.student);
                        readContract?.getCertificatesByStudent(s.student).then((res: any) => {
                          setStudentCerts(res);
                        });
                      }}
                      className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
                    >
                      {s.metadata?.studentName} ({truncateAddress(s.student)})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error state alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Verification Alert</p>
            <p className="mt-0.5 text-xs opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Student Certificates List Result */}
      {studentCerts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Certificates Issued to Wallet ({studentCerts.length})
          </h3>
          <div className="space-y-3">
            {studentCerts.map((cid, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4"
              >
                <div className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate">
                  {cid}
                </div>
                <button
                  onClick={() => {
                    setCertIdInput(cid);
                    setActiveTab("id");
                    verifyById(cid);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0"
                >
                  Inspect Certificate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VERIFICATION RESULT CARD */}
      {verificationResult && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all">
          {/* Top Status Banner */}
          <div
            className={`p-6 sm:p-8 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              verificationResult.isValid
                ? "bg-gradient-to-r from-emerald-600 to-teal-600"
                : "bg-gradient-to-r from-rose-600 to-red-600"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                {verificationResult.isValid ? (
                  <ShieldCheck className="w-8 h-8 text-white" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-white" />
                )}
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold opacity-90">
                  Ethereum On-Chain Audit
                </span>
                <h2 className="text-2xl font-black tracking-tight">
                  {verificationResult.isValid ? "VERIFIED & AUTHENTIC" : "INVALID OR REVOKED"}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(currentUrl, "shareUrl")}
                className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm transition-colors"
              >
                {copiedField === "shareUrl" ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                Shareable Link
              </button>
            </div>
          </div>

          {/* Certificate Detailed Body */}
          <div className="p-6 sm:p-8 space-y-8">
            {/* Student & Degree Details */}
            {verificationResult.metadata && (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-4 gap-2">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Degree Awarded</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {verificationResult.metadata.degree}
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      {verificationResult.metadata.program}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Conferred To</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {verificationResult.metadata.studentName}
                    </p>
                    {verificationResult.metadata.graduationDate && (
                      <p className="text-xs text-slate-500">Graduation: {verificationResult.metadata.graduationDate}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Grid of cryptographic details & QR code */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Details column (2 cols) */}
              <div className="md:col-span-2 space-y-4">
                {/* Issuer */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    Authorized Issuing University
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white text-base">
                    {verificationResult.institutionName || "Unknown Institution"}
                  </p>
                  <p className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate">
                    {verificationResult.cert.institution}
                  </p>
                </div>

                {/* Student Address */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    Recipient Student Wallet
                  </span>
                  <p className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                    {verificationResult.cert.student}
                  </p>
                </div>

                {/* Issuance Date */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    Anchor Timestamp
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {formatDate(verificationResult.cert.issuedAt)}
                  </p>
                </div>

                {/* Document SHA-256 */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                      Document Hash (SHA-256)
                    </span>
                    <button
                      onClick={() => copyToClipboard(verificationResult.cert.docHash, "docHash")}
                      className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      {copiedField === "docHash" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all">
                    {verificationResult.cert.docHash}
                  </p>
                </div>

                {/* IPFS CID */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                      IPFS Content Identifier (CID)
                    </span>
                    <a
                      href={getApiUrl(`/api/ipfs/${verificationResult.cert.ipfsCid}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 font-semibold"
                    >
                      View Document <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all">
                    {verificationResult.cert.ipfsCid}
                  </p>
                </div>
              </div>

              {/* QR Code column */}
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Verification QR Code
                </span>
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                  <QRCodeSVG
                    value={window.location.origin + `/verify/${verificationResult.cert.id}`}
                    size={160}
                    level="H"
                  />
                </div>
                <p className="text-[11px] text-slate-500 max-w-[180px] leading-tight">
                  Scan to independently verify on any mobile device.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
