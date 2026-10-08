import { Router } from "express";
import { getActiveQueries, updateQueries, getActiveSubreddits, updateSubreddits } from "../controllers/config.controller";

const router = Router();

router.get("/", getActiveQueries);
router.post("/", updateQueries);

router.get("/subreddits", getActiveSubreddits);
router.post("/subreddits", updateSubreddits);

export default router;
