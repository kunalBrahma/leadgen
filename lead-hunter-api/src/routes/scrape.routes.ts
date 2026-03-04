import { Router } from "express";
import rateLimit from "express-rate-limit";
import { triggerManualScrape } from "../controllers/scrape.controller";

const router = Router();

// Limit scrape triggering to 5 per 10 minutes per IP
const scrapeLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: { success: false, message: "Too many scrape requests. Please wait a few minutes." }
});

router.post("/", scrapeLimiter, triggerManualScrape);

export default router;
