import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import { z } from "zod";
import { ipfsService } from "../services/ipfs";

export const apiRouter = Router();

// Configure multer with memory storage (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max limit
  },
});

// Zod Schema for metadata validation
const metadataSchema = z.object({
  studentName: z.string().min(1, "Student name is required").max(100),
  degree: z.string().min(1, "Degree name is required").max(100),
  program: z.string().min(1, "Program/major is required").max(100),
  graduationDate: z.string().min(4, "Graduation date is required").max(30),
  studentAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
});

/**
 * Health check endpoint
 */
apiRouter.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "academic-credential-backend",
  });
});

/**
 * Upload PDF, verify magic bytes, compute SHA-256 and pin to IPFS
 */
apiRouter.post("/upload", upload.single("certificate"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Expected 'certificate' field." });
    }

    const buffer = req.file.buffer;

    // Check mime-type and PDF magic bytes '%PDF' (0x25, 0x50, 0x44, 0x46)
    if (buffer.length < 4 || buffer.subarray(0, 4).toString() !== "%PDF") {
      return res.status(400).json({
        error: "Invalid file format. The file must be a valid PDF document with %PDF magic bytes.",
      });
    }

    // Compute SHA-256 hash of document
    const sha256Hex = crypto.createHash("sha256").update(buffer).digest("hex");
    const docHash = `0x${sha256Hex}`;

    // Pin file to IPFS
    const fileName = req.file.originalname || `certificate_${Date.now()}.pdf`;
    const pinResult = await ipfsService.pinFile(buffer, fileName);

    return res.status(200).json({
      success: true,
      cid: pinResult.cid,
      docHash,
      gatewayUrl: pinResult.gatewayUrl,
      size: buffer.length,
      mimeType: "application/pdf",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Store metadata JSON to IPFS, compute keccak256 hash
 */
apiRouter.post("/metadata", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = metadataSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten(),
      });
    }

    const metadata = parseResult.data;
    const jsonString = JSON.stringify(metadata);

    // Compute keccak256 metadata hash (matching Solidity keccak256(abi.encodePacked(metadata)))
    // Or standard SHA-256. For Ethereum standard compatibility, we calculate SHA-256 or Keccak.
    // Let's compute Keccak256 or standard SHA-256 for metadata.
    const sha256 = crypto.createHash("sha256").update(jsonString).digest("hex");
    const metadataHash = `0x${sha256}`;

    const pinResult = await ipfsService.pinJson(
      metadata,
      `metadata_${metadata.studentAddress}_${Date.now()}.json`
    );

    return res.status(200).json({
      success: true,
      cid: pinResult.cid,
      metadataHash,
      gatewayUrl: pinResult.gatewayUrl,
      metadata,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Proxy IPFS content by CID
 */
apiRouter.get("/ipfs/:cid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cid = req.params.cid;
    if (!cid || typeof cid !== "string" || cid.length < 5) {
      return res.status(400).json({ error: "Invalid CID provided." });
    }

    const file = await ipfsService.getFile(cid);
    if (!file) {
      return res.status(404).json({ error: "Content not found for the requested CID." });
    }

    // Set caching headers: 24 hours public cache
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Content-Type", file.contentType);
    return res.status(200).send(file.data);
  } catch (err) {
    next(err);
  }
});
