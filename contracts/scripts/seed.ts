import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("Seeding CredentialRegistry on network:", network.name);

  const [admin, demoUniversity, student1, student2] = await ethers.getSigners();

  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await CredentialRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("Deployed CredentialRegistry at:", registryAddress);

  // Authorize Massachusetts Institute of Technology
  console.log("Authorizing MIT (account:", demoUniversity.address, ")...");
  const authTx = await registry.connect(admin).authorizeInstitution(
    demoUniversity.address,
    "Massachusetts Institute of Technology (MIT)"
  );
  await authTx.wait();
  console.log("MIT authorized successfully.");

  // Sample Certificate 1: Computer Science BS
  const meta1 = JSON.stringify({
    studentName: "Elena Rostova",
    degree: "Bachelor of Science",
    program: "Computer Science and Engineering",
    graduationDate: "2026-06-01",
    studentAddress: student1.address,
  });
  const cid1 = "bafybeicg2n4vdn4k5p7q734jndvd6b3gqy2n2f427f7k27f2f7q734jndv";
  const docHash1 = ethers.sha256(ethers.toUtf8Bytes("DEMO_DEGREE_PDF_ELENA_ROSTOVA_MIT_2026"));
  const metaHash1 = ethers.keccak256(ethers.toUtf8Bytes(meta1));

  console.log("Issuing Certificate 1 for student Elena (", student1.address, ")...");
  const tx1 = await registry.connect(demoUniversity).issueCertificate(
    student1.address,
    cid1,
    docHash1,
    metaHash1
  );
  await tx1.wait();
  const certId1 = await registry.docHashToCertId(docHash1);
  console.log("Certificate 1 issued. ID:", certId1);
  console.log("  DocHash:", docHash1);

  // Sample Certificate 2: Artificial Intelligence MS
  const meta2 = JSON.stringify({
    studentName: "Marcus Vance",
    degree: "Master of Science",
    program: "Artificial Intelligence and Robotics",
    graduationDate: "2026-05-20",
    studentAddress: student2.address,
  });
  const cid2 = "bafybeidv7f7k27f2f7q734jndvd6b3gqy2n2f427cg2n4vdn4k5p7q734j";
  const docHash2 = ethers.sha256(ethers.toUtf8Bytes("DEMO_DEGREE_PDF_MARCUS_VANCE_MIT_2026"));
  const metaHash2 = ethers.keccak256(ethers.toUtf8Bytes(meta2));

  console.log("Issuing Certificate 2 for student Marcus (", student2.address, ")...");
  const tx2 = await registry.connect(demoUniversity).issueCertificate(
    student2.address,
    cid2,
    docHash2,
    metaHash2
  );
  await tx2.wait();
  const certId2 = await registry.docHashToCertId(docHash2);
  console.log("Certificate 2 issued. ID:", certId2);
  console.log("  DocHash:", docHash2);

  // Export contract address and ABI
  const artifactPath = path.join(__dirname, "../artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const exportData = {
    address: registryAddress,
    abi: artifact.abi,
    network: network.name,
    chainId: network.chainId.toString(),
    demoUniversity: demoUniversity.address,
    sampleCertificates: [
      { id: certId1, student: student1.address, docHash: docHash1, cid: cid1, metadata: JSON.parse(meta1) },
      { id: certId2, student: student2.address, docHash: docHash2, cid: cid2, metadata: JSON.parse(meta2) }
    ]
  };

  const targetDirs = [
    path.join(__dirname, "../../frontend/src/contracts"),
    path.join(__dirname, "../../backend/src/contracts"),
  ];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(dir, "CredentialRegistry.json"),
      JSON.stringify(exportData, null, 2),
      "utf8"
    );
    console.log("Exported contract info to:", dir);
  }
  console.log("Seed process finished successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
