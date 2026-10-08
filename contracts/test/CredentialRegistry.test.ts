import { expect } from "chai";
import { ethers } from "hardhat";
import { CredentialRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CredentialRegistry", function () {
  let registry: CredentialRegistry;
  let admin: HardhatEthersSigner;
  let university: HardhatEthersSigner;
  let university2: HardhatEthersSigner;
  let student1: HardhatEthersSigner;
  let student2: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;

  const INSTITUTION_ROLE = ethers.keccak256(ethers.toUtf8Bytes("INSTITUTION_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  const sampleDocHash1 = ethers.sha256(ethers.toUtf8Bytes("Sample Degree PDF Content 1"));
  const sampleDocHash2 = ethers.sha256(ethers.toUtf8Bytes("Sample Degree PDF Content 2"));
  const sampleMetadataHash1 = ethers.keccak256(
    ethers.toUtf8Bytes(
      JSON.stringify({
        studentName: "Alice Smith",
        degree: "Bachelor of Science",
        program: "Computer Science",
        graduationDate: "2026-05-15",
      })
    )
  );
  const sampleMetadataHash2 = ethers.keccak256(
    ethers.toUtf8Bytes(
      JSON.stringify({
        studentName: "Bob Jones",
        degree: "Master of Engineering",
        program: "Artificial Intelligence",
        graduationDate: "2026-06-20",
      })
    )
  );
  const sampleIpfsCid1 = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
  const sampleIpfsCid2 = "QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx";

  beforeEach(async function () {
    [admin, university, university2, student1, student2, unauthorized] = await ethers.getSigners();

    const CredentialRegistryFactory = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistryFactory.deploy();
    await registry.waitForDeployment();
  });

  describe("Role & Access Initialization", function () {
    it("should set deployer as DEFAULT_ADMIN_ROLE", async function () {
      expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await registry.hasRole(INSTITUTION_ROLE, admin.address)).to.be.false;
    });
  });

  describe("Institution Authorization & Revocation", function () {
    it("admin can authorize an institution and emit event", async function () {
      await expect(registry.connect(admin).authorizeInstitution(university.address, "MIT"))
        .to.emit(registry, "InstitutionAuthorized")
        .withArgs(university.address, "MIT");

      expect(await registry.hasRole(INSTITUTION_ROLE, university.address)).to.be.true;
      expect(await registry.institutionNames(university.address)).to.equal("MIT");
    });

    it("non-admin cannot authorize an institution", async function () {
      await expect(
        registry.connect(unauthorized).authorizeInstitution(university.address, "MIT")
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("cannot authorize zero address or empty name", async function () {
      await expect(
        registry.connect(admin).authorizeInstitution(ethers.ZeroAddress, "MIT")
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");

      await expect(
        registry.connect(admin).authorizeInstitution(university.address, "")
      ).to.be.revertedWithCustomError(registry, "EmptyName");
    });

    it("cannot authorize an already authorized institution", async function () {
      await registry.connect(admin).authorizeInstitution(university.address, "MIT");
      await expect(
        registry.connect(admin).authorizeInstitution(university.address, "MIT Duplicate")
      ).to.be.revertedWithCustomError(registry, "InstitutionAlreadyAuthorized");
    });

    it("admin can revoke an authorized institution", async function () {
      await registry.connect(admin).authorizeInstitution(university.address, "MIT");
      await expect(registry.connect(admin).revokeInstitution(university.address))
        .to.emit(registry, "InstitutionRevoked")
        .withArgs(university.address);

      expect(await registry.hasRole(INSTITUTION_ROLE, university.address)).to.be.false;
    });

    it("cannot revoke an institution that is not authorized", async function () {
      await expect(
        registry.connect(admin).revokeInstitution(unauthorized.address)
      ).to.be.revertedWithCustomError(registry, "InstitutionNotAuthorized");
    });
  });

  describe("Certificate Issuance", function () {
    beforeEach(async function () {
      await registry.connect(admin).authorizeInstitution(university.address, "Stanford University");
    });

    it("authorized institution can issue a certificate and emit event", async function () {
      const tx = await registry
        .connect(university)
        .issueCertificate(student1.address, sampleIpfsCid1, sampleDocHash1, sampleMetadataHash1);

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // Check event
      await expect(tx)
        .to.emit(registry, "CertificateIssued");

      // Check mappings
      expect(await registry.docHashExists(sampleDocHash1)).to.be.true;
      const certId = await registry.docHashToCertId(sampleDocHash1);
      expect(certId).to.not.equal(ethers.ZeroHash);

      // Verify certificate
      const [cert, instName, valid] = await registry.verifyCertificate(certId);
      expect(cert.institution).to.equal(university.address);
      expect(cert.student).to.equal(student1.address);
      expect(cert.ipfsCid).to.equal(sampleIpfsCid1);
      expect(cert.docHash).to.equal(sampleDocHash1);
      expect(cert.metadataHash).to.equal(sampleMetadataHash1);
      expect(cert.revoked).to.be.false;
      expect(instName).to.equal("Stanford University");
      expect(valid).to.be.true;
    });

    it("unauthorized caller cannot issue a certificate", async function () {
      await expect(
        registry
          .connect(unauthorized)
          .issueCertificate(student1.address, sampleIpfsCid1, sampleDocHash1, sampleMetadataHash1)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("rejects duplicate document hash", async function () {
      await registry
        .connect(university)
        .issueCertificate(student1.address, sampleIpfsCid1, sampleDocHash1, sampleMetadataHash1);

      await expect(
        registry
          .connect(university)
          .issueCertificate(student2.address, sampleIpfsCid2, sampleDocHash1, sampleMetadataHash2)
      ).to.be.revertedWithCustomError(registry, "DuplicateDocumentHash");
    });

    it("validates input parameters (zero address, empty CID, empty hash)", async function () {
      await expect(
        registry
          .connect(university)
          .issueCertificate(ethers.ZeroAddress, sampleIpfsCid1, sampleDocHash1, sampleMetadataHash1)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");

      await expect(
        registry
          .connect(university)
          .issueCertificate(student1.address, "", sampleDocHash1, sampleMetadataHash1)
      ).to.be.revertedWithCustomError(registry, "EmptyString");

      await expect(
        registry
          .connect(university)
          .issueCertificate(student1.address, sampleIpfsCid1, ethers.ZeroHash, sampleMetadataHash1)
      ).to.be.revertedWithCustomError(registry, "EmptyHash");

      await expect(
        registry
          .connect(university)
          .issueCertificate(student1.address, sampleIpfsCid1, sampleDocHash1, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "EmptyHash");
    });
  });

  describe("Certificate Revocation", function () {
    let certId: string;

    beforeEach(async function () {
      await registry.connect(admin).authorizeInstitution(university.address, "Harvard");
      await registry.connect(admin).authorizeInstitution(university2.address, "Oxford");

      const tx = await registry
        .connect(university)
        .issueCertificate(student1.address, sampleIpfsCid1, sampleDocHash1, sampleMetadataHash1);
      await tx.wait();
      certId = await registry.docHashToCertId(sampleDocHash1);
    });

    it("issuing institution can revoke its certificate", async function () {
      await expect(registry.connect(university).revokeCertificate(certId))
        .to.emit(registry, "CertificateRevoked")
        .withArgs(certId, university.address);

      const [cert, , valid] = await registry.verifyCertificate(certId);
      expect(cert.revoked).to.be.true;
      expect(valid).to.be.false;
    });

    it("another institution cannot revoke the certificate", async function () {
      await expect(
        registry.connect(university2).revokeCertificate(certId)
      ).to.be.revertedWithCustomError(registry, "NotIssuingInstitution");
    });

    it("cannot revoke a non-existent certificate", async function () {
      const nonExistentId = ethers.keccak256(ethers.toUtf8Bytes("random-non-existent-id"));
      await expect(
        registry.connect(university).revokeCertificate(nonExistentId)
      ).to.be.revertedWithCustomError(registry, "CertificateNotFound");
    });

    it("cannot revoke an already revoked certificate", async function () {
      await registry.connect(university).revokeCertificate(certId);
      await expect(
        registry.connect(university).revokeCertificate(certId)
      ).to.be.revertedWithCustomError(registry, "CertificateAlreadyRevoked");
    });

    it("certificate becomes invalid if issuing university is revoked by admin", async function () {
      const [, , validBefore] = await registry.verifyCertificate(certId);
      expect(validBefore).to.be.true;

      await registry.connect(admin).revokeInstitution(university.address);

      const [, , validAfter] = await registry.verifyCertificate(certId);
      expect(validAfter).to.be.false;
    });
  });

  describe("Lookups and Verification", function () {
    let certId1: string;
    let certId2: string;

    beforeEach(async function () {
      await registry.connect(admin).authorizeInstitution(university.address, "Princeton University");

      await registry
        .connect(university)
        .issueCertificate(student1.address, sampleIpfsCid1, sampleDocHash1, sampleMetadataHash1);
      certId1 = await registry.docHashToCertId(sampleDocHash1);

      await registry
        .connect(university)
        .issueCertificate(student1.address, sampleIpfsCid2, sampleDocHash2, sampleMetadataHash2);
      certId2 = await registry.docHashToCertId(sampleDocHash2);
    });

    it("verifies correctly via verifyByHash", async function () {
      const [cert, name, valid] = await registry.verifyByHash(sampleDocHash1);
      expect(cert.id).to.equal(certId1);
      expect(name).to.equal("Princeton University");
      expect(valid).to.be.true;

      const [emptyCert, emptyName, validFalse] = await registry.verifyByHash(
        ethers.sha256(ethers.toUtf8Bytes("Unregistered Document"))
      );
      expect(emptyCert.issuedAt).to.equal(0);
      expect(emptyName).to.equal("");
      expect(validFalse).to.be.false;
    });

    it("retrieves all certificates for a student", async function () {
      const certs = await registry.getCertificatesByStudent(student1.address);
      expect(certs.length).to.equal(2);
      expect(certs[0]).to.equal(certId1);
      expect(certs[1]).to.equal(certId2);

      const noCerts = await registry.getCertificatesByStudent(student2.address);
      expect(noCerts.length).to.equal(0);
    });

    it("returns valid=false for non-existent certificate ID", async function () {
      const [cert, name, valid] = await registry.verifyCertificate(
        ethers.keccak256(ethers.toUtf8Bytes("random-unissued"))
      );
      expect(cert.issuedAt).to.equal(0);
      expect(name).to.equal("");
      expect(valid).to.be.false;
    });
  });
});
