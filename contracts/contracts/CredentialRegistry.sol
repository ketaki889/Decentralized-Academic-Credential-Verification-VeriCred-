// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CredentialRegistry
 * @dev On-chain registry for academic credentials issued by authorized institutions.
 *      Personal identifiable info is stored strictly off-chain on IPFS and only hashed.
 */
contract CredentialRegistry is AccessControl {
    bytes32 public constant INSTITUTION_ROLE = keccak256("INSTITUTION_ROLE");

    struct Certificate {
        bytes32 id;
        address institution;
        address student;
        string ipfsCid;
        bytes32 docHash;
        bytes32 metadataHash;
        uint64 issuedAt;
        bool revoked;
    }

    // Mapping from certificate ID => Certificate details
    mapping(bytes32 => Certificate) private certificates;

    // Mapping to prevent issuing certificates with duplicate PDF document hashes
    mapping(bytes32 => bool) public docHashExists;

    // Mapping from document hash => Certificate ID
    mapping(bytes32 => bytes32) public docHashToCertId;

    // Mapping from student address => array of Certificate IDs
    mapping(address => bytes32[]) private studentCertificates;

    // Mapping from institution address => human readable name
    mapping(address => string) public institutionNames;

    // Nonce for unique certificate ID generation
    uint256 private _certNonce;

    // Custom errors
    error InvalidAddress();
    error EmptyName();
    error EmptyString();
    error EmptyHash();
    error InstitutionAlreadyAuthorized();
    error InstitutionNotAuthorized();
    error DuplicateDocumentHash();
    error CertificateNotFound();
    error CertificateAlreadyRevoked();
    error NotIssuingInstitution();

    // Events
    event InstitutionAuthorized(address indexed institution, string name);
    event InstitutionRevoked(address indexed institution);
    event CertificateIssued(
        bytes32 indexed id,
        address indexed institution,
        address indexed student,
        bytes32 docHash,
        string ipfsCid
    );
    event CertificateRevoked(bytes32 indexed id, address indexed institution);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Authorize an educational institution to issue credentials.
     * @param institution The wallet address representing the institution.
     * @param name The legal name of the university or institution.
     */
    function authorizeInstitution(address institution, string calldata name) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (institution == address(0)) revert InvalidAddress();
        if (bytes(name).length == 0) revert EmptyName();
        if (hasRole(INSTITUTION_ROLE, institution)) revert InstitutionAlreadyAuthorized();

        _grantRole(INSTITUTION_ROLE, institution);
        institutionNames[institution] = name;

        emit InstitutionAuthorized(institution, name);
    }

    /**
     * @notice Revoke the issuing authority of an institution.
     * @param institution The wallet address of the institution.
     */
    function revokeInstitution(address institution) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!hasRole(INSTITUTION_ROLE, institution)) revert InstitutionNotAuthorized();

        _revokeRole(INSTITUTION_ROLE, institution);

        emit InstitutionRevoked(institution);
    }

    /**
     * @notice Issue a new tamper-proof credential anchored on-chain.
     * @param student The recipient student's Ethereum address.
     * @param ipfsCid The IPFS Content Identifier for the certificate PDF.
     * @param docHash The SHA-256 hash of the certificate PDF.
     * @param metadataHash The keccak256 hash of off-chain metadata (student name, degree, etc.).
     * @return id The unique identifier of the issued certificate.
     */
    function issueCertificate(
        address student,
        string calldata ipfsCid,
        bytes32 docHash,
        bytes32 metadataHash
    ) external onlyRole(INSTITUTION_ROLE) returns (bytes32 id) {
        if (student == address(0)) revert InvalidAddress();
        if (bytes(ipfsCid).length == 0) revert EmptyString();
        if (docHash == bytes32(0) || metadataHash == bytes32(0)) revert EmptyHash();
        if (docHashExists[docHash]) revert DuplicateDocumentHash();

        _certNonce++;
        id = keccak256(abi.encodePacked(msg.sender, student, docHash, _certNonce, block.timestamp));

        Certificate memory newCert = Certificate({
            id: id,
            institution: msg.sender,
            student: student,
            ipfsCid: ipfsCid,
            docHash: docHash,
            metadataHash: metadataHash,
            issuedAt: uint64(block.timestamp),
            revoked: false
        });

        certificates[id] = newCert;
        docHashExists[docHash] = true;
        docHashToCertId[docHash] = id;
        studentCertificates[student].push(id);

        emit CertificateIssued(id, msg.sender, student, docHash, ipfsCid);
        return id;
    }

    /**
     * @notice Revoke an issued certificate. Can only be invoked by the issuing institution.
     * @param id The certificate identifier to revoke.
     */
    function revokeCertificate(bytes32 id) external onlyRole(INSTITUTION_ROLE) {
        Certificate storage cert = certificates[id];
        if (cert.issuedAt == 0) revert CertificateNotFound();
        if (cert.institution != msg.sender) revert NotIssuingInstitution();
        if (cert.revoked) revert CertificateAlreadyRevoked();

        cert.revoked = true;

        emit CertificateRevoked(id, msg.sender);
    }

    /**
     * @notice Verify a certificate by its unique ID.
     * @param id The certificate ID.
     * @return cert The Certificate data struct.
     * @return institutionName The registered human-readable name of the issuing institution.
     * @return valid True if certificate exists, is not revoked, and issuer still has INSTITUTION_ROLE.
     */
    function verifyCertificate(bytes32 id)
        external
        view
        returns (
            Certificate memory cert,
            string memory institutionName,
            bool valid
        )
    {
        cert = certificates[id];
        if (cert.issuedAt == 0) {
            return (cert, "", false);
        }

        institutionName = institutionNames[cert.institution];
        // Valid if not revoked and institution has not been revoked by admin
        valid = (!cert.revoked && hasRole(INSTITUTION_ROLE, cert.institution));
        return (cert, institutionName, valid);
    }

    /**
     * @notice Verify a certificate by the document's SHA-256 hash (allows client-side drag-and-drop verification).
     * @param docHash The SHA-256 hash of the uploaded document.
     * @return cert The Certificate data struct.
     * @return institutionName The registered institution name.
     * @return valid True if certificate exists and is valid.
     */
    function verifyByHash(bytes32 docHash)
        external
        view
        returns (
            Certificate memory cert,
            string memory institutionName,
            bool valid
        )
    {
        bytes32 certId = docHashToCertId[docHash];
        if (certId == bytes32(0)) {
            Certificate memory emptyCert;
            return (emptyCert, "", false);
        }

        return this.verifyCertificate(certId);
    }

    /**
     * @notice Retrieve all certificate IDs issued to a particular student address.
     * @param student The wallet address of the student.
     * @return Array of certificate IDs.
     */
    function getCertificatesByStudent(address student) external view returns (bytes32[] memory) {
        return studentCertificates[student];
    }
}
