import { Router } from "express";
import { getActiveQueries, updateQueries } from "../controllers/config.controller";

const router = Router();

router.get("/", getActiveQueries);
router.post("/", updateQueries);

export default router;
