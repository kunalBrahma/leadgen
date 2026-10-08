import type { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/prisma";

export const CreateLeadSchema = z.object({
  platform: z.string(),
  platformPostId: z.string(),
  authorHandle: z.string(),
  content: z.string(),
  url: z.string(),
  intentScore: z.number().optional(),
  founderScore: z.number().optional(),
  analysis: z.string().optional(),
  isBuyer: z.boolean().optional(),
  searchContext: z.string().optional(),
  postedAt: z.string().datetime().optional(),
  status: z.string().optional(),
});

export const UpdateLeadSchema = z.object({
  platform: z.string().optional(),
  platformPostId: z.string().optional(),
  authorHandle: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  intentScore: z.number().optional(),
  founderScore: z.number().optional(),
  analysis: z.string().optional(),
  isBuyer: z.boolean().optional(),
  searchContext: z.string().optional(),
  postedAt: z.string().datetime().optional(),
  status: z.string().optional(),
});

// Dedicated stats endpoint — no need to fetch all leads
export async function getLeadStats(req: Request, res: Response): Promise<void> {
  try {
    const [total, hotLeads, avgResult, buyerCount] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { intentScore: { gte: 7 } } }),
      prisma.lead.aggregate({ _avg: { intentScore: true } }),
      prisma.lead.count({ where: { isBuyer: true } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        hotLeads,
        buyerCount,
        avgIntent: Math.round((avgResult._avg.intentScore || 0) * 10) / 10,
      }
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// Delete all leads (with cascade to replies)
export async function deleteAllLeads(req: Request, res: Response): Promise<void> {
  try {
    await prisma.generatedReply.deleteMany({});
    const result = await prisma.lead.deleteMany({});
    res.status(200).json({ success: true, message: `Deleted ${result.count} leads` });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export async function createLead(req: Request, res: Response): Promise<void> {
  try {

    const parsed = CreateLeadSchema.parse(req.body);
    const data: Prisma.LeadUncheckedCreateInput = { ...parsed } as Prisma.LeadUncheckedCreateInput;

    const lead = await prisma.lead.create({ data });
    res.status(201).json({ success: true, data: lead });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const formatted = error.flatten();
      res.status(400).json({ success: false, errors: formatted.fieldErrors });
      return;
    }
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export async function getAllLeads(req: Request, res: Response): Promise<void> {
  try {
    const { page = "1", limit = "10", search, sortBy = "createdAt", sortOrder = "desc", ...filters } = req.query;
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const validSortFields = ["id", "platform", "platformPostId", "authorHandle", "content", "url", "intentScore", "founderScore", "status", "createdAt"];
    if (!validSortFields.includes(sortBy as string)) {
      res.status(400).json({ success: false, message: `Invalid sortBy field. Allowed fields: ${validSortFields.join(", ")}` });
      return;
    }

    const validFilterFields = ["platform", "status", "isBuyer", "authorHandle"];
    const where: Prisma.LeadWhereInput = {};
    for (const key in filters) {
      if (validFilterFields.includes(key)) {
        let value: any = filters[key];

        if (value === "true") value = true;
        if (value === "false") value = false;

        type WhereKey = keyof Prisma.LeadWhereInput;
        where[key as WhereKey] = value;
      }
    }

    if (search) {
      where.OR = [
        { platform: { contains: search as string, mode: "insensitive" } },
        { authorHandle: { contains: search as string, mode: "insensitive" } },
        { content: { contains: search as string, mode: "insensitive" } },
        { url: { contains: search as string, mode: "insensitive" } },
        { status: { contains: search as string, mode: "insensitive" } }
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: { [sortBy as string]: sortOrder as string },
      }),
      prisma.lead.count({ where })
    ]);

    res.status(200).json({
      success: true,
      count: leads.length,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      data: leads
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export async function getLeadById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }
    res.status(200).json({ success: true, data: lead });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export async function updateLead(req: Request, res: Response): Promise<void> {
  try {

    const { id } = req.params;
    const parsed = UpdateLeadSchema.parse(req.body);
    const data: Prisma.LeadUncheckedUpdateInput = { ...parsed } as Prisma.LeadUncheckedUpdateInput;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }

    const updated = await prisma.lead.update({ where: { id }, data });
    res.status(200).json({ success: true, data: updated });

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const formatted = error.flatten();
      res.status(400).json({ success: false, errors: formatted.fieldErrors });
      return;
    }
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export async function updateLeadStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ["detected", "contacted", "replied", "closed"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: `Invalid status. Allowed: ${validStatuses.join(", ")}` });
      return;
    }
    const lead = await prisma.lead.update({ where: { id }, data: { status } });
    res.status(200).json({ success: true, data: lead });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export async function deleteLead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }
    await prisma.lead.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Lead deleted successfully" });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
