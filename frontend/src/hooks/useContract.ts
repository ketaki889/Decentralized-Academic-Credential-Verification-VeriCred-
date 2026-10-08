import { useMemo } from "react";
import { Contract, JsonRpcProvider, Signer } from "ethers";
import contractArtifact from "../contracts/CredentialRegistry.json";

// Default fallback local RPC
const DEFAULT_RPC = "http://127.0.0.1:8545";

export const INSTITUTION_ROLE = "0x892a0e285a22d718b958c21966a3d1320efb197ccb4ec2b6b553e1a8fa0e9d69"; // keccak256("INSTITUTION_ROLE")
export const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function useContract(signer: Signer | null = null) {
  const contractAddress = contractArtifact.address;
  const contractAbi = contractArtifact.abi;

  // Read-only provider connected to public / local RPC
  const readOnlyProvider = useMemo(() => {
    return new JsonRpcProvider(DEFAULT_RPC);
  }, []);

  // Read-only contract instance
  const readContract = useMemo(() => {
    return new Contract(contractAddress, contractAbi, readOnlyProvider);
  }, [contractAddress, contractAbi, readOnlyProvider]);

  // Signer-connected contract for write operations
  const writeContract = useMemo(() => {
    if (!signer) return null;
    return new Contract(contractAddress, contractAbi, signer);
  }, [contractAddress, contractAbi, signer]);

  return {
    contractAddress,
    contractAbi,
    readContract,
    writeContract,
    demoUniversity: (contractArtifact as any).demoUniversity || null,
    sampleCertificates: (contractArtifact as any).sampleCertificates || [],
  };
}
