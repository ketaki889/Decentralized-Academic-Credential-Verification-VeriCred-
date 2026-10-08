import pinataSDK from "@pinata/sdk";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

export interface PinResult {
  cid: string;
  gatewayUrl: string;
}

// Fallback in-memory and local disk IPFS simulator for standalone / local dev
class LocalIpfsSimulator {
  private storageDir: string;

  constructor() {
    this.storageDir = path.join(__dirname, "../../../storage/ipfs");
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public pinFile(buffer: Buffer, originalName?: string): PinResult {
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    // Generate deterministic CIDv1 format imitation
    const cid = `bafybei${sha256.substring(0, 46)}`;
    const filePath = path.join(this.storageDir, cid);
    fs.writeFileSync(filePath, buffer);
    return {
      cid,
      gatewayUrl: `/api/ipfs/${cid}`,
    };
  }

  public pinJson(data: object): PinResult {
    const jsonStr = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(jsonStr, "utf8");
    return this.pinFile(buffer);
  }

  public getFile(cid: string): Buffer | null {
    const filePath = path.join(this.storageDir, cid);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    return null;
  }
}

export class IpfsService {
  private pinata: any = null;
  private localSimulator: LocalIpfsSimulator;
  private isPinataConfigured: boolean = false;
  private gatewayBase: string;

  constructor() {
    this.localSimulator = new LocalIpfsSimulator();
    const jwt = process.env.PINATA_JWT;
    const apiKey = process.env.PINATA_API_KEY;
    const apiSecret = process.env.PINATA_API_SECRET;
    this.gatewayBase = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

    if (jwt) {
      this.pinata = new (pinataSDK as any)({ pinataJWTKey: jwt });
      this.isPinataConfigured = true;
    } else if (apiKey && apiSecret) {
      this.pinata = new (pinataSDK as any)(apiKey, apiSecret);
      this.isPinataConfigured = true;
    } else {
      console.log("[IpfsService] Pinata credentials not provided. Using local IPFS mock simulator for zero-friction local dev.");
    }
  }

  public async pinFile(buffer: Buffer, fileName: string): Promise<PinResult> {
    if (this.isPinataConfigured && this.pinata) {
      try {
        const stream = Readable.from(buffer);
        const options = {
          pinataMetadata: {
            name: fileName,
          },
        };
        const result = await this.pinata.pinFileToIPFS(stream, options);
        return {
          cid: result.IpfsHash,
          gatewayUrl: `${this.gatewayBase}${result.IpfsHash}`,
        };
      } catch (err) {
        console.warn("[IpfsService] Pinata file upload failed. Falling back to local storage simulator:", err);
      }
    }

    return this.localSimulator.pinFile(buffer, fileName);
  }

  public async pinJson(data: object, name: string): Promise<PinResult> {
    if (this.isPinataConfigured && this.pinata) {
      try {
        const options = {
          pinataMetadata: {
            name,
          },
        };
        const result = await this.pinata.pinJSONToIPFS(data, options);
        return {
          cid: result.IpfsHash,
          gatewayUrl: `${this.gatewayBase}${result.IpfsHash}`,
        };
      } catch (err) {
        console.warn("[IpfsService] Pinata JSON upload failed. Falling back to local storage simulator:", err);
      }
    }

    return this.localSimulator.pinJson(data);
  }

  public async getFile(cid: string): Promise<{ data: Buffer; contentType: string } | null> {
    // Check local storage first
    const localBuf = this.localSimulator.getFile(cid);
    if (localBuf) {
      const isPdf = localBuf.subarray(0, 4).toString() === "%PDF";
      return {
        data: localBuf,
        contentType: isPdf ? "application/pdf" : "application/json",
      };
    }

    // Try fetching from public/pinata gateway
    try {
      const response = await fetch(`${this.gatewayBase}${cid}`);
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        return {
          data: Buffer.from(arrayBuf),
          contentType,
        };
      }
    } catch (err) {
      console.warn(`[IpfsService] Could not proxy IPFS content for CID ${cid}:`, err);
    }

    return null;
  }
}

export const ipfsService = new IpfsService();
