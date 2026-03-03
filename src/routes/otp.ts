import { Router } from "express";
import { requestOtp, verifyOtpHandler } from "../controllers/otp.js";

const router = Router();

router.post("/send", requestOtp);
router.post("/verify", verifyOtpHandler);

export default router;