import React, { useState, useEffect } from "react";
import {
  Building2,
  PlusCircle,
  FileText,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Shield,
  Key,
} from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useContract, INSTITUTION_ROLE } from "../hooks/useContract";
import { truncateAddress, formatDate } from "../lib/crypto";

interface IssuedCertItem {
  id: string;
  student: string;
  ipfsCid: string;
  docHash: string;
  metadataHash: string;
  issuedAt: number;
  revoked: boolean;
  institutionName: string;
  metadata?: any;
}

export const DashboardPage: React.FC = () => {
  const { account, signer, connect } = useWallet();
  const { readContract, writeContract } = useContract(signer);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [institutionName, setInstitutionName] = useState<string>("");
  const [issuedCerts, setIssuedCerts] = useState<IssuedCertItem[]>([]);
  const [isLoadingCerts, setIsLoadingCerts] = useState(false);

  // Form State
  const [studentAddress, setStudentAddress] = useState("");
  const [studentName, setStudentName] = useState("");
  const [degree, setDegree] = useState("");
  const [program, setProgram] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [encryptToggle, setEncryptToggle] = useState(false);

  // Issue Progress & Stepper
  const [issueStep, setIssueStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Revocation Modal
  const [certToRevoke, setCertToRevoke] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Check authorization role
  useEffect(() => {
    if (!account || !readContract) {
      setIsAuthorized(false);
      return;
    }

    let isMounted = true;
    async function checkRole() {
      try {
        const hasRole = await readContract.hasRole(INSTITUTION_ROLE, account);
        if (isMounted) {
          setIsAuthorized(hasRole);
          if (hasRole) {
            const name = await readContract.institutionNames(account);
            setInstitutionName(name || "Authorized University");
          }
        }
      } catch (err) {
        if (isMounted) setIsAuthorized(false);
      }
    }
    checkRole();
    return () => {
      isMounted = false;
    };
  }, [account, readContract]);

  // Load sample or query past events
  const loadCerts = async () => {
    if (!readContract || !account) return;
    setIsLoadingCerts(true);
    try {
      // Query CertificateIssued events filtered by this institution
      const filter = readContract.filters.CertificateIssued(null, account, null);
      const events = await readContract.queryFilter(filter, 0, "latest");

      const items: IssuedCertItem[] = [];
      for (const ev of events) {
        const id = (ev as any).args?.[0];
        if (id) {
          const [cert, instName] = await readContract.verifyCertificate(id);
          items.push({
            id: cert.id,
            student: cert.student,
            ipfsCid: cert.ipfsCid,
            docHash: cert.docHash,
            metadataHash: cert.metadataHash,
            issuedAt: Number(cert.issuedAt),
            revoked: cert.revoked,
            institutionName: instName,
          });
        }
      }
      setIssuedCerts(items.reverse());
    } catch (err) {
      console.warn("Failed querying past certs:", err);
    } finally {
      setIsLoadingCerts(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadCerts();
    }
  }, [isAuthorized, account]);

  // Submit Issue Certificate
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile || !studentAddress || !studentName || !degree || !program) {
      setIssueError("Please complete all required fields and upload the diploma PDF.");
      return;
    }
    if (!writeContract) {
      setIssueError("Signer not ready. Please connect your authorized university wallet.");
      return;
    }

    setIssueError(null);
    setTxHash(null);

    try {
      // Step 1: Upload and Pin PDF to IPFS
      setIssueStep(1);
      const formData = new FormData();
      formData.append("certificate", pdfFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const errJson = await uploadRes.json();
        throw new Error(errJson.error || "Failed to upload document to IPFS backend.");
      }
      const uploadData = await uploadRes.json();
      const ipfsCid = uploadData.cid;
      const docHash = uploadData.docHash;

      // Step 2: Pin Metadata to IPFS
      setIssueStep(2);
      const metaRes = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          degree,
          program,
          graduationDate: graduationDate || new Date().toISOString().split("T")[0],
          studentAddress,
        }),
      });
      if (!metaRes.ok) {
        const errJson = await metaRes.json();
        throw new Error(errJson.error || "Failed to pin metadata to IPFS.");
      }
      const metaData = await metaRes.json();
      const metadataHash = metaData.metadataHash;

      // Step 3: Send Transaction to Ethereum Smart Contract
      setIssueStep(3);
      const tx = await writeContract.issueCertificate(
        studentAddress,
        ipfsCid,
        docHash,
        metadataHash
      );
      setTxHash(tx.hash);

      // Step 4: Wait for Confirmation
      await tx.wait();
      setIssueStep(4);

      // Reset form & reload certificates
      setStudentAddress("");
      setStudentName("");
      setDegree("");
      setProgram("");
      setGraduationDate("");
      setPdfFile(null);
      loadCerts();
    } catch (err: any) {
      console.error("Issuance failed:", err);
      setIssueError(err.reason || err.message || "Certificate issuance failed.");
      setIssueStep(0);
    }
  };

  // Revoke Certificate
  const handleRevoke = async () => {
    if (!certToRevoke || !writeContract) return;
    setIsRevoking(true);
    try {
      const tx = await writeContract.revokeCertificate(certToRevoke);
      await tx.wait();
      setCertToRevoke(null);
      loadCerts();
    } catch (err: any) {
      alert("Revocation failed: " + (err.reason || err.message));
    } finally {
      setIsRevoking(false);
    }
  };

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">University Portal Access</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Please connect your MetaMask wallet with an authorized institution key to issue and manage academic certificates.
        </p>
        <button
          onClick={connect}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          Connect University Wallet
        </button>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Institution Not Authorized</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          The connected account <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{account}</span> does not have the <code className="text-blue-500 font-mono">INSTITUTION_ROLE</code> permission on the CredentialRegistry.
        </p>
        <p className="text-xs text-slate-500">
          Tip: In local dev, use the seeded MIT account: <span className="font-mono text-blue-500 font-semibold">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</span> or authorize this wallet via the Admin page.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider font-semibold text-blue-300 flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            University Management Console
          </span>
          <h1 className="text-3xl font-extrabold">{institutionName || "Authorized University"}</h1>
          <p className="text-xs font-mono text-slate-300">{account}</p>
        </div>
        <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          INSTITUTION_ROLE Active
        </div>
      </div>

      {/* Main Grid: Issue Form (Left) & Issued Records (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Issue Certificate Form */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Issue Digital Certificate</h2>
          </div>

          <form onSubmit={handleIssueSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Student Wallet Address (0x...)
              </label>
              <input
                type="text"
                required
                placeholder="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
                value={studentAddress}
                onChange={(e) => setStudentAddress(e.target.value.trim())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Student Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Elena Rostova"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Degree Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="Bachelor of Science"
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Program / Major
                </label>
                <input
                  type="text"
                  required
                  placeholder="Computer Science"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Graduation Date
              </label>
              <input
                type="date"
                value={graduationDate}
                onChange={(e) => setGraduationDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* PDF File Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Official Diploma PDF
              </label>
              <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 transition-colors bg-slate-50 dark:bg-slate-800/40">
                <input
                  type="file"
                  required
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="pdf-upload-input"
                />
                <label htmlFor="pdf-upload-input" className="cursor-pointer">
                  <UploadCloud className="w-6 h-6 mx-auto text-blue-500 mb-1" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {pdfFile ? pdfFile.name : "Click to attach PDF diploma"}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Max size 10MB</span>
                </label>
              </div>
            </div>

            {/* Optional Encryption Toggle */}
            <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  AES-GCM Encryption before IPFS
                </span>
              </div>
              <input
                type="checkbox"
                checked={encryptToggle}
                onChange={(e) => setEncryptToggle(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Error Message */}
            {issueError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{issueError}</span>
              </div>
            )}

            {/* Stepper Progress */}
            {issueStep > 0 && (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
                  <span>
                    {issueStep === 1 && "1/3 Uploading & Pinning PDF to IPFS..."}
                    {issueStep === 2 && "2/3 Anchoring Metadata..."}
                    {issueStep === 3 && "3/3 Confirming Ethereum Transaction..."}
                    {issueStep === 4 && "Certificate Issued Successfully!"}
                  </span>
                  {issueStep < 4 ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>

                {txHash && (
                  <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate">
                    Tx: {txHash}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={issueStep > 0 && issueStep < 4}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {issueStep > 0 && issueStep < 4 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Issuance...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Issue Certificate to Ethereum
                </>
              )}
            </button>
          </form>
        </div>

        {/* Issued Certificates Table */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Issued Credentials</h2>
                <p className="text-xs text-slate-500">History of certificates issued by this university</p>
              </div>
              <button
                onClick={loadCerts}
                disabled={isLoadingCerts}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Refresh Table"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingCerts ? "animate-spin" : ""}`} />
              </button>
            </div>

            {issuedCerts.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-sm">No certificates issued yet by this account.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase">
                    <tr>
                      <th className="pb-3 font-semibold">Certificate ID</th>
                      <th className="pb-3 font-semibold">Student</th>
                      <th className="pb-3 font-semibold">Date</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {issuedCerts.map((cert) => (
                      <tr key={cert.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 text-blue-600 dark:text-blue-400">
                          <a
                            href={`/verify/${cert.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline flex items-center gap-1"
                          >
                            {truncateAddress(cert.id, 4)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="py-3 text-slate-700 dark:text-slate-300">
                          {truncateAddress(cert.student, 4)}
                        </td>
                        <td className="py-3 text-slate-500 font-sans">
                          {formatDate(cert.issuedAt)}
                        </td>
                        <td className="py-3 font-sans">
                          {cert.revoked ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-semibold">
                              Revoked
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right font-sans">
                          {!cert.revoked && (
                            <button
                              onClick={() => setCertToRevoke(cert.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revocation Confirmation Modal */}
      {certToRevoke && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Revoke Certificate</h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to permanently revoke certificate <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{truncateAddress(certToRevoke, 6)}</span>? This action is recorded immutably on Ethereum and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setCertToRevoke(null)}
                disabled={isRevoking}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={isRevoking}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {isRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
