import { Request, Response } from "express";
import OpenAI from "openai";
import prisma from "../config/prisma";
import "dotenv/config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getReplyPrompt = (replyStyle: string, searchContext: string) => `
You are a Senior Software Architect specializing in ${searchContext}. You reply to posts on X (Twitter).

TONE:
- Tech-native, knowledgeable peer. You sound like a busy developer, not a marketer.
- Use lowercase for technical terms (e.g., 'postgres', 'nextjs', 'redis', 'kubernetes').
- Occasionally start sentences in lowercase to sound natural and dev-like.
- Be direct. No fluff. Every word earns its place.

RULES:
- Directly address a specific technical friction point from the post.
- NEVER say: "I can help", "DM me", "Let's connect", "As an expert", "Happy to chat", "Check out my services".
- No hashtags. No emojis. No markdown. No quotes around the reply.
- Response MUST be under 240 characters (leave room for the @mention prefix).
- Output ONLY the reply text. Nothing else. No preamble.

STYLE INSTRUCTIONS:
${replyStyle === "authoritative" ? `- Identify a specific architectural pattern, anti-pattern, or "gotcha" relevant to their problem (N+1 queries, cold starts, connection pooling, race conditions, etc.).\n- Name drop the exact tool or pattern that fixes it.` : ""}
${replyStyle === "helpful" ? `- Share a one-sentence technical "war story" — something you've actually solved before.\n- Format: "we hit this exact issue when..." or "solved this by switching to...".\n- Make it sound like hard-earned experience, not a textbook answer.` : ""}
${replyStyle === "witty" ? `- Use dry, cynical technical humor about bloated stacks, over-engineering, or "resume-driven development".\n- Think: the sarcastic senior dev in the Slack channel who's seen it all.\n- Still be helpful underneath the humor.` : ""}

BAD REPLY (too salesy):
"As an expert in cloud architecture, I can help you optimize this. DM me!"

GOOD REPLY (authoritative):
"classic N+1 problem — try batching with dataloader or switching to a sql JOIN. prisma's relationLoadStrategy: 'join' flag fixes this in one line"

GOOD REPLY (helpful):
"we hit this exact wall scaling to 50k concurrent users. moved the hot path to redis streams + a worker queue and response times dropped 10x"

GOOD REPLY (witty):
"ah yes the classic 'microservices for a todo app' architecture. a single postgres instance and a deploy script would have shipped 6 months ago"
`;

export async function generateReply(req: Request, res: Response): Promise<void> {
    try {
        const { leadId: id } = req.params;
        const body = req.body || {};
        const { replyStyle = "helpful" } = body;

        const lead = await prisma.lead.findUnique({ where: { id } });
        if (!lead) {
            res.status(404).json({ success: false, message: "Lead not found" });
            return;
        }

        const searchContext = lead.searchContext || "Senior Backend Architecture";

        const userPrompt = [
            `Reply to this X post:`,
            ``,
            `Author: ${lead.authorHandle}`,
            `Post: ${lead.content}`,
            `Target Niche Context: ${searchContext}`,
            lead.analysis ? `\nAI Analysis of this lead: ${lead.analysis}` : "",
        ].filter(Boolean).join("\n");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            max_tokens: 100,
            messages: [
                { role: "system", content: getReplyPrompt(replyStyle, searchContext) },
                { role: "user", content: userPrompt },
            ],
        });

        let rawReply = (completion.choices[0]?.message?.content || "").trim();

        // Strip any quotes the model might wrap the reply in
        rawReply = rawReply.replace(/^["']|["']$/g, "");

        // Prepend the author handle so it's ready to paste into X
        let suggestedText = `${lead.authorHandle} ${rawReply}`;

        // Hard truncate if it exceeds 280 characters
        if (suggestedText.length > 280) {
            suggestedText = suggestedText.slice(0, 277) + "...";
        }

        const reply = await prisma.generatedReply.create({
            data: {
                leadId: lead.id,
                suggestedText,
                replyStyle,
                usedInProduction: false,
            },
        });

        res.status(200).json({ success: true, data: reply });
    } catch (error: unknown) {
        console.error("❌ Reply generation failed:", error);
        if (error instanceof Error) {
            res.status(500).json({ success: false, message: error.message });
            return;
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
