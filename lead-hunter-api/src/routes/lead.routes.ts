import { Router } from "express";
import { createLead, deleteLead, getAllLeads, getLeadById, updateLead, getLeadStats, deleteAllLeads, updateLeadStatus } from "../controllers/lead.controller";
import { generateReply } from "../controllers/reply.controller";

const router = Router();

// Stats must come before /:id
router.get("/stats", getLeadStats);

router.post("/:leadId/generate-reply", generateReply);

router.post("/", createLead);
router.get("/", getAllLeads);
// Delete ALL must come before individual delete
router.delete("/", deleteAllLeads);

router.get("/:id", getLeadById);
router.put("/:id", updateLead);
router.patch("/:id/status", updateLeadStatus);
router.delete("/:id", deleteLead);

export default router;

