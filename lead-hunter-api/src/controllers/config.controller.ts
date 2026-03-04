import { Request, Response } from 'express';
import prisma from '../config/prisma';

// 1. FOR THE FRONTEND: Update the active queries
export const updateQueries = async (req: Request, res: Response) => {
    try {
        const { queries } = req.body; // Expecting an array of strings: ["query 1", "query 2"]

        if (!Array.isArray(queries)) {
            return res.status(400).json({ success: false, error: "Queries must be an array of strings" });
        }

        // Upsert a single config record (assuming one main persona for now)
        const config = await prisma.intentConfig.upsert({
            where: { id: "default-config-id" },
            update: { activeKeywords: queries },
            create: {
                id: "default-config-id",
                targetPersona: "High-Ticket SaaS",
                activeKeywords: queries,
                isActive: true
            }
        });

        res.json({ success: true, config });
    } catch (error) {
        console.error("Failed to update queries:", error);
        res.status(500).json({ success: false, error: "Failed to update queries" });
    }
};

// 2. FOR THE PYTHON SCRAPER: Fetch the live queries
export const getActiveQueries = async (req: Request, res: Response) => {
    try {
        const config = await prisma.intentConfig.findUnique({
            where: { id: "default-config-id" }
        });

        // Extract the JSON array, or provide a default fallback
        const queries = config?.activeKeywords ? (config.activeKeywords as string[]) : ["need a backend developer"];

        res.json({ success: true, queries });
    } catch (error) {
        console.error("Failed to fetch queries:", error);
        res.status(500).json({ success: false, queries: ["need a backend developer"] }); // Fallback so scraper doesn't crash
    }
};
