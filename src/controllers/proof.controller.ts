/**
 * JanPramaan — Proof controller
 */
import { Request, Response, NextFunction } from 'express';
import * as proofService from '../services/proof.service';
import QRCode from 'qrcode';

export async function getProof(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await proofService.getIssueProof(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Generate a QR code data URL linking to the public proof page for this issue.
 */
export async function getQR(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const proofUrl = `${req.protocol}://${req.get('host')}/api/issues/${id}/proof`;
    const qrDataUrl = await QRCode.toDataURL(proofUrl, { width: 300 });
    res.json({ issueId: id, qrDataUrl, proofUrl });
  } catch (err) {
    next(err);
  }
}
