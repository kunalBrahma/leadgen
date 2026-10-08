import { Request, Response } from 'express';
import prisma from '../config/prisma';

const QUERY_CONFIG_ID = "default-config-id";
const SUBREDDIT_CONFIG_ID = "subreddit-config-id";

const DEFAULT_SUBREDDITS = [
    "smallbusiness", "entrepreneur", "startups", "webdesign", "Wordpress"
];

// ── Keywords (X / LinkedIn scraper) ─────────────────────────────────────────

export const updateQueries = async (req: Request, res: Response) => {
    try {
        const { queries } = req.body;
        if (!Array.isArray(queries)) {
            res.status(400).json({ success: false, error: "Queries must be an array of strings" });
            return;
        }
        const config = await prisma.intentConfig.upsert({
            where: { id: QUERY_CONFIG_ID },
            update: { activeKeywords: queries },
            create: { id: QUERY_CONFIG_ID, targetPersona: "Web Design Clients", activeKeywords: queries, isActive: true }
        });
        res.json({ success: true, config });
    } catch (error) {
        console.error("Failed to update queries:", error);
        res.status(500).json({ success: false, error: "Failed to update queries" });
    }
};

export const getActiveQueries = async (req: Request, res: Response) => {
    try {
        const config = await prisma.intentConfig.findUnique({ where: { id: QUERY_CONFIG_ID } });
        const queries = config?.activeKeywords ? (config.activeKeywords as string[]) : ["need a website"];
        res.json({ success: true, queries });
    } catch (error) {
        console.error("Failed to fetch queries:", error);
        res.status(500).json({ success: false, queries: ["need a website"] });
    }
};

// ── Subreddits (Reddit scraper) ──────────────────────────────────────────────

export const updateSubreddits = async (req: Request, res: Response) => {
    try {
        const { subreddits } = req.body;
        if (!Array.isArray(subreddits)) {
            res.status(400).json({ success: false, error: "Subreddits must be an array of strings" });
            return;
        }
        const config = await prisma.intentConfig.upsert({
            where: { id: SUBREDDIT_CONFIG_ID },
            update: { activeKeywords: subreddits },
            create: { id: SUBREDDIT_CONFIG_ID, targetPersona: "Reddit Subreddits", activeKeywords: subreddits, isActive: true }
        });
        res.json({ success: true, subreddits });
    } catch (error) {
        console.error("Failed to update subreddits:", error);
        res.status(500).json({ success: false, error: "Failed to update subreddits" });
    }
};

export const getActiveSubreddits = async (req: Request, res: Response) => {
    try {
        const config = await prisma.intentConfig.findUnique({ where: { id: SUBREDDIT_CONFIG_ID } });
        const subreddits = config?.activeKeywords ? (config.activeKeywords as string[]) : DEFAULT_SUBREDDITS;
        res.json({ success: true, subreddits });
    } catch (error) {
        console.error("Failed to fetch subreddits:", error);
        res.status(500).json({ success: false, subreddits: DEFAULT_SUBREDDITS });
    }
};
