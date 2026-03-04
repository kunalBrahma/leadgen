import { Redis } from "ioredis";
import OpenAI from "openai";
import prisma from "../config/prisma";
import "dotenv/config";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6380");
const QUEUE_NAME = "raw_leads";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getPostAge(postedAt: string | null): string {
    if (!postedAt) return "unknown (assume recent)";
    const posted = new Date(postedAt);
    const now = new Date();
    const diffMs = now.getTime() - posted.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "less than 1 hour ago (very fresh)";
    if (diffHours < 6) return `${diffHours} hours ago (fresh)`;
    if (diffHours < 24) return `${diffHours} hours ago (today)`;
    if (diffDays < 3) return `${diffDays} days ago (recent)`;
    if (diffDays < 7) return `${diffDays} days ago (getting stale)`;
    return `${diffDays} days ago (stale — they likely found a solution already)`;
}

const getSystemPrompt = (targetContext: string) => `
You are an elite lead qualification analyst. You analyze social media posts found by searching for "${targetContext}".

Your job: determine if the AUTHOR is a BUYER who wants to PAY someone for "${targetContext}" services, AND if the opportunity is still fresh.

SCORING RUBRIC for intentScore (0-10):
- 0: Seller, freelancer, promoter, student, or completely irrelevant
- 1-3: Tangentially related discussion, no buying signal
- 4-5: Mentions the topic but unclear if they need to hire someone
- 6-7: Shows clear need/pain point, likely needs help
- 8-9: Explicitly asking for help, mentions budget/timeline/hiring
- 10: Direct "hiring now" or "need someone ASAP" with urgency

SCORING RUBRIC for founderScore (0-10):
This measures how likely the author is a DECISION-MAKER who can actually sign a contract.
- 0: Anonymous, no identity signals, bot
- 1-3: Individual with unclear role, random person
- 4-6: Appears to be a professional, team lead, or manager
- 7-9: Likely a founder, CTO, CEO, or VP-level decision-maker
- 10: Verified founder/CEO with company name explicitly mentioned

TIME DECAY RULE (CRITICAL):
- Posted < 6 hours ago: No penalty. Score normally.
- Posted 6-24 hours ago: Reduce intentScore by 1 point.
- Posted 1-3 days ago: Reduce intentScore by 2 points.
- Posted 3-7 days ago: Reduce intentScore by 3 points.
- Posted 7+ days ago: Maximum intentScore is 3. The opportunity is likely gone.
- Apply time decay AFTER calculating the raw intent score. Final score cannot go below 0.
- Time decay does NOT affect founderScore (a founder is still a founder).

AUTOMATIC ZERO (intentScore=0, is_buyer=false):
- Author is SELLING their services (freelancer, agency, "I build X", "I help companies with X")
- Author is promoting content (blog, newsletter, course, tutorial, thread)
- Author is a student sharing learning progress
- Author is sharing news, opinions, or memes — not seeking help
- Author is giving advice, writing thought leadership, or using hypothetical examples about hiring (e.g. "When I need to hire a developer...") — they are NOT actually hiring right now.
- Author is BUILDING IT THEMSELVES (Solo Creator Bias, DIY). If they are celebrating not needing a dev team or CTO, or building their own SaaS, they are NOT a buyer.
- Author is asking for FEEDBACK or a ROAST on their project. They want free opinions, not to pay someone for services. (No Transfer of Value: Money for Work).

EXAMPLES:
Post (1 hour ago): "We need a Node.js developer for our fintech startup. DM me"
→ {"analysis":"Startup founder hiring a dev, direct buying signal. Very fresh.","is_buyer":true,"intentScore":9,"founderScore":8}

Post (5 days ago): "Looking for someone to build my MVP"
→ {"analysis":"Buyer seeking an MVP builder, but posted 5 days ago — reducing score.","is_buyer":true,"intentScore":4,"founderScore":6}

Post: "When I need to find a technical co-founder, I always check their GitHub. Here is a thread on how to hire a developer 🧵"
→ {"analysis":"Thought leadership / advice post using hypothetical hiring phrases. Not actively hiring.","is_buyer":false,"intentScore":0,"founderScore":7}

Post: "You don't need a massive dev team or CTO anymore. As a solo creator, I just built my MVP using Cursor and Nextjs in a weekend."
→ {"analysis":"Solo creator celebrating building it themselves. Actively avoiding hiring.","is_buyer":false,"intentScore":0,"founderScore":8}

Post: "Just shipped v1 of my app! Seeking a public roast of my landing page. Let me know what you think!"
→ {"analysis":"Builder sharing a project for free feedback/roasts, not looking to hire a developer.","is_buyer":false,"intentScore":0,"founderScore":5}

Post: "I'm a full-stack developer available for freelance work"
→ {"analysis":"Freelancer selling services, not a buyer.","is_buyer":false,"intentScore":0,"founderScore":0}

Post: "Just learned how to deploy on AWS!"
→ {"analysis":"Student sharing learning progress.","is_buyer":false,"intentScore":0,"founderScore":0}

Respond with ONLY valid JSON. No markdown, no explanation.
{"analysis":"string","is_buyer":boolean,"intentScore":number,"founderScore":number}
`;

async function gradeLeadWithGPT(content: string, author: string, searchContext: string, postedAt: string | null) {
    try {
        const postAge = getPostAge(postedAt);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: getSystemPrompt(searchContext),
                },
                {
                    role: "user",
                    content: `This post was found by searching X.com for "${searchContext}".\nPost age: ${postAge}\n\nAuthor: ${author}\nPost: ${content}`,
                },
            ],
        });

        const raw = completion.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw);

        const isBuyer = !!parsed.is_buyer;
        const intentScore = isBuyer ? Math.min(10, Math.max(0, Number(parsed.intentScore) || 0)) : 0;
        const founderScore = Math.min(10, Math.max(0, Number(parsed.founderScore) || 0));

        return {
            analysis: parsed.analysis || "",
            isBuyer,
            intentScore,
            founderScore,
        };
    } catch (error: any) {
        console.error("❌ GPT-4o-mini Inference Failed:", error?.message || error);
        return { analysis: "Error during analysis", isBuyer: false, intentScore: 0, founderScore: 0 };
    }
}

async function startWorker() {
    console.log("🧠 Intent Worker started (GPT-4o-mini). Listening for leads...");

    while (true) {
        try {
            const result = await redis.brpop(QUEUE_NAME, 0);

            if (result) {
                const rawLead = JSON.parse(result[1]);
                const searchContext = rawLead.searchContext || "software development";
                const postedAt = rawLead.postedAt || null;
                console.log(`\n📥 Processing post from ${rawLead.authorHandle} [context: ${searchContext}]...`);

                const aiGrading = await gradeLeadWithGPT(
                    rawLead.content,
                    rawLead.authorHandle,
                    searchContext,
                    postedAt
                );
                console.log(`📊 Graded: ${aiGrading.isBuyer ? 'BUYER ✅' : 'REJECT ❌'} | Intent ${aiGrading.intentScore}/10 | Founder ${aiGrading.founderScore}/10`);
                console.log(`📝 Analysis: ${aiGrading.analysis}`);

                const savedLead = await prisma.lead.upsert({
                    where: { platformPostId: rawLead.platformPostId },
                    update: {
                        intentScore: aiGrading.intentScore,
                        founderScore: aiGrading.founderScore,
                        analysis: aiGrading.analysis,
                        isBuyer: aiGrading.isBuyer,
                        searchContext,
                        postedAt: postedAt ? new Date(postedAt) : undefined,
                    },
                    create: {
                        platform: rawLead.platform,
                        platformPostId: rawLead.platformPostId,
                        authorHandle: rawLead.authorHandle,
                        content: rawLead.content,
                        url: rawLead.url,
                        intentScore: aiGrading.intentScore,
                        founderScore: aiGrading.founderScore,
                        analysis: aiGrading.analysis,
                        isBuyer: aiGrading.isBuyer,
                        searchContext,
                        postedAt: postedAt ? new Date(postedAt) : undefined,
                        status: "detected"
                    },
                });

                console.log(`✅ ${savedLead.id ? 'Synced' : 'Processed'} Lead: ${rawLead.authorHandle}`);
            }
        } catch (error: any) {
            console.error("Worker Error:", error?.message || "Unknown error");
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
}

startWorker();