import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";

// Default localhost chain id
const LOCALHOST_CHAIN_ID = "0x7a69"; // 31337 in hex
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

export interface WalletState {
  account: string | null;
  chainId: string | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    account: null,
    chainId: null,
    provider: null,
    signer: null,
    isConnecting: false,
    error: null,
  });

  const getEthereum = () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return null;
  };

  const connect = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setWallet((prev) => ({
        ...prev,
        error: "MetaMask not detected. Please install MetaMask to use Web3 features.",
      }));
      return;
    }

    try {
      setWallet((prev) => ({ ...prev, isConnecting: true, error: null }));
      const provider = new BrowserProvider(ethereum);
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const chainId = await ethereum.request({ method: "eth_chainId" });
      const signer = await provider.getSigner();

      setWallet({
        account: accounts[0] || null,
        chainId,
        provider,
        signer,
        isConnecting: false,
        error: null,
      });
    } catch (err: any) {
      setWallet((prev) => ({
        ...prev,
        isConnecting: false,
        error: err.message || "Failed to connect wallet",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({
      account: null,
      chainId: null,
      provider: null,
      signer: null,
      isConnecting: false,
      error: null,
    });
  }, []);

  const switchNetwork = useCallback(async (targetChainId: "localhost" | "sepolia" = "localhost") => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const chainHex = targetChainId === "sepolia" ? SEPOLIA_CHAIN_ID : LOCALHOST_CHAIN_ID;

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
    } catch (switchError: any) {
      // Error code 4902 indicates chain has not been added yet
      if (switchError.code === 4902 && targetChainId === "localhost") {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: LOCALHOST_CHAIN_ID,
                chainName: "Hardhat Localhost",
                rpcUrls: ["http://127.0.0.1:8545"],
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
              },
            ],
          });
        } catch (addError) {
          console.error("Failed to add network:", addError);
        }
      }
    }
  }, []);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        const provider = new BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        setWallet((prev) => ({
          ...prev,
          account: accounts[0],
          provider,
          signer,
        }));
      }
    };

    const handleChainChanged = (chainId: string) => {
      setWallet((prev) => ({ ...prev, chainId }));
      window.location.reload();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    // Initial silent check
    ethereum
      .request({ method: "eth_accounts" })
      .then(async (accounts: string[]) => {
        if (accounts.length > 0) {
          const provider = new BrowserProvider(ethereum);
          const chainId = await ethereum.request({ method: "eth_chainId" });
          const signer = await provider.getSigner();
          setWallet({
            account: accounts[0],
            chainId,
            provider,
            signer,
            isConnecting: false,
            error: null,
          });
        }
      })
      .catch((e: any) => console.log("Silent check failed:", e));

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [disconnect]);

  return {
    ...wallet,
    connect,
    disconnect,
    switchNetwork,
  };
}
