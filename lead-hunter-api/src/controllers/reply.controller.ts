import { Request, Response } from "express";
import OpenAI from "openai";
import prisma from "../config/prisma";
import "dotenv/config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getPlatformRules = (platform: string) => {
    if (platform === "LinkedIn") return {
        format: "LinkedIn comment or DM",
        charLimit: 1200,
        prependHandle: false,
        toneRule: "Professional but warm. Sound like a fellow business owner, not a salesperson. 2-3 sentences is fine. No corporate buzzwords.",
        doNot: "Do NOT start with @handle. LinkedIn DMs don't work that way. Do NOT use Twitter slang.",
    };
    if (platform === "Reddit") return {
        format: "Reddit comment reply",
        charLimit: 600,
        prependHandle: false,
        toneRule: "Sound like a genuine community member who has been through the same thing. Helpful, conversational, fits the subreddit culture. 2-3 sentences.",
        doNot: "Do NOT start with the username or @handle. Reddit comments never do that. Do NOT sound like a salesperson or agency.",
    };
    // Default: X / Twitter
    return {
        format: "Twitter/X public reply",
        charLimit: 240,
        prependHandle: true,
        toneRule: "Casual, punchy, brutally concise. 1-2 short sentences max. Twitter audience hates waffle.",
        doNot: "Do NOT write more than 2 sentences. Do NOT sound corporate.",
    };
};

const getReplyPrompt = (replyStyle: string, platform: string) => {
    const platformRules = getPlatformRules(platform);
    return `
You are a battle-tested web designer and studio owner with 10 years of experience building websites for small businesses. You run SiteMakerLab. You are scrolling ${platformRules.format} and replying to a potential client.

PLATFORM: ${platformRules.format}
TONE: ${platformRules.toneRule}
DO NOT: ${platformRules.doNot}

UNIVERSAL RULES:
1. Write in all lowercase. Do not capitalize the first letter of sentences.
2. FORBIDDEN AI WORDS: Never use "seamless", "robust", "delve", "navigate", "supercharge", "streamline", "tapestry", "vital", "crucial", "game changer", "tackle", "dive".
3. NO DASHES: Never use hyphens (-), en-dashes (–), or em-dashes (—). Use a comma or period instead.
4. No hashtags. No emojis. No markdown. No quotes around the reply.
5. NEVER pitch services directly. NEVER say "dm me", "i can help", "happy to chat", or "check out my portfolio".
6. Sound like a human who has solved this exact problem before, not an agency bot.

STYLE:
${replyStyle === "authoritative" ? `Point out the specific mistake or wrong assumption they are making about their website situation. Name a concrete fix, tool, or approach. Be direct and confident.` : ""}
${replyStyle === "helpful" ? `Share a brief war story about a similar website problem you or a client faced. Make it sound like hard-earned experience. Start with "ran into this when..." or "had a client with this exact issue...".` : ""}
${replyStyle === "witty" ? `Use dry humor about the pain of bad websites, DIY website builders, or clients who delay going online. Be funny but actually useful.` : ""}
${replyStyle === "story" ? `Tell a short, specific story about a real client or situation you dealt with that mirrors their problem. Make it feel personal and relatable. Start with "worked with a [business type] last year who had the exact same issue...". End with what actually solved it. No pitch.` : ""}
${replyStyle === "question" ? `Ask one single genuine, thoughtful question that shows you understand their situation deeply. The question should make them want to reply and think "this person actually gets it". Never ask two questions. Never pitch. Just one sharp question.` : ""}

EXAMPLES:
authoritative (X): "classic wix seo trap. switching to a proper cms with clean url structure fixes rankings within 6 weeks, wix rewrites urls on every publish"
helpful (Reddit): "had a client in the same spot last year, no website at all and losing jobs to competitors who had one. the issue wasn't the cost, it was not knowing where to start. happy to share what actually worked for them if useful."
witty (LinkedIn): "the squarespace graveyard is full of businesses that looked great on mobile preview and invisible on google. you're not alone in this."
`;
};

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

        const platform = lead.platform || "X";
        const platformRules = getPlatformRules(platform);

        const userPrompt = [
            `Platform: ${platform}`,
            `Post content: ${lead.content}`,
            lead.bio ? `Author bio: ${lead.bio}` : "",
            lead.searchContext ? `Found via: ${lead.searchContext}` : "",
            lead.analysis ? `AI qualification notes: ${lead.analysis}` : "",
        ].filter(Boolean).join("\n");

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.85,
            max_tokens: platform === "X" ? 60 : 120,
            messages: [
                { role: "system", content: getReplyPrompt(replyStyle, platform) },
                { role: "user", content: userPrompt },
            ],
        });

        let rawReply = (completion.choices[0]?.message?.content || "").trim();

        // POST-PROCESSING
        rawReply = rawReply.replace(/^["']|["']$/g, "");
        rawReply = rawReply.replace(/[-—–]/g, " ");
        rawReply = rawReply.toLowerCase();

        // Platform-specific formatting
        let suggestedText: string;
        if (platformRules.prependHandle) {
            // X: prepend @handle for public reply
            const safeHandle = lead.authorHandle.startsWith("@") ? lead.authorHandle : `@${lead.authorHandle}`;
            suggestedText = `${safeHandle} ${rawReply}`;
        } else {
            // LinkedIn / Reddit: no @handle prefix
            suggestedText = rawReply;
        }

        // Enforce platform char limit
        if (suggestedText.length > platformRules.charLimit) {
            suggestedText = suggestedText.slice(0, platformRules.charLimit - 3) + "...";
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