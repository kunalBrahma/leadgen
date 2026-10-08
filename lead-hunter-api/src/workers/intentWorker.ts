import { Redis } from "ioredis";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import prisma from "../config/prisma";
import "dotenv/config";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6380");
const QUEUE_NAME = "raw_leads";
const MAX_RETRIES = 3;
const RETRY_KEY_PREFIX = "lead_retry_count:";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Fix #1: Zod Schema for Structured Outputs ─────────────────────────────
// Guarantees 100% type-safe JSON from OpenAI. No hallucinated keys.
const SDRGradingSchema = z.object({
    total_score: z.number().int().min(1).max(10)
        .describe("Overall lead qualification score from 1-10"),
    buying_power_score: z.number().int().min(0).max(4)
        .describe("0-4: Can they afford premium services?"),
    pain_awareness_score: z.number().int().min(0).max(3)
        .describe("0-3: Are they explicitly stating a business problem?"),
    actionability_score: z.number().int().min(0).max(3)
        .describe("0-3: Are they ready to act and hire NOW?"),
    qualification_reason: z.string()
        .describe("1 concise sentence explaining the score rationale"),
    suggested_icebreaker: z.string()
        .describe("Highly personalized, conversational DM opener. Do NOT pitch. Ask about their bottleneck. Make it 2-3 sentences."),
});

type SDRGrading = z.infer<typeof SDRGradingSchema>;

const SYSTEM_PROMPT = `
You are an elite B2B Sales Development Representative (SDR) qualifying leads for SiteMakerLab, a premium web design and development studio that builds professional websites, landing pages, e-commerce stores, and custom web platforms for businesses.

TARGET CLIENTS: Small business owners, founders, and operators in foreign English-speaking markets (US, UK, Canada, Australia) who need a website built, redesigned, or improved. They run restaurants, retail shops, service businesses, e-commerce stores, real estate agencies, consultancies, law firms, clinics, gyms, or any business that needs a strong online presence.

Analyze the provided JSON payload of a prospect. Score the lead from 1 to 10 based ONLY on their likelihood to hire a web studio to build or redesign their website.

TONE & STYLE RULES FOR SUGGESTED ICEBREAKER (private DM/message):
1. Write exactly like a real person sending a cold DM, not a salesperson.
2. Use all lowercase. Do not capitalize the first letter of sentences.
3. Be conversational and specific to their post. Never be generic. 2 to 3 sentences max.
4. Reference their exact pain point or business situation from the post.
5. FORBIDDEN AI WORDS: Never use "seamless", "robust", "delve", "navigate", "supercharge", "streamline", "tapestry", "vital", "crucial", "game changer", "tackle", "dive".
6. NO DASHES ALLOWED: Never use hyphens (-), en-dashes (–), or em-dashes (—). Use a comma or period instead.
7. No hashtags. No emojis. No markdown. No quotes around the reply.
8. NEVER hard pitch. NEVER say "dm me", "i can help", "happy to chat", or "check out my portfolio".
9. PLATFORM AWARENESS — adjust tone based on the platform field:
   - X/Twitter DM: Very casual, short, like texting a stranger. 1-2 sentences.
   - LinkedIn DM: Slightly more professional. Mention you saw their post. 2-3 sentences.
   - Reddit DM: Community-first. Reference the subreddit or their specific post. Very low pressure. 2-3 sentences.

CRITICAL CONTEXT & AWARENESS RULES:
1. READ THE BIO: Accurately identify their actual business type from their bio/title. NEVER hallucinate their industry.
2. WEB-SPECIFIC PAIN SIGNALS: Watch for: "our website is outdated", "we have no website", "lost customers because of our site", "squarespace isn't working", "wix is terrible", "need a new website", "site looks unprofessional", "low conversions", "website not showing on google", "need a landing page", "our online store is broken", "can't update the website".
3. CELEBRATORY POSTS: If a post is celebratory (grand opening, business launch, anniversary), DO NOT dig for pain. Send a warm congratulatory message (e.g., "congrats on the launch! opening a new location is no joke. hope the first week crushes it").

EVALUATION CRITERIA:
1. Buying Power (0-4 points):
   - 4 = Business owner, founder, CEO, or operator of a real operating business with customers and revenue.
   - 3 = Director, manager, or decision-maker at an SMB or growing company.
   - 2 = Self-employed professional (realtor, consultant, therapist, contractor) who controls their own budget.
   - 1 = Early-stage solo entrepreneur with unclear revenue.
   - 0 = Student, job seeker, hobbyist, "indie hacker" with no business, or a direct competitor (web agency, freelance developer).

2. Pain Awareness (0-3 points):
   - 3 = Explicitly complaining about their website, online presence, lack of a site, poor conversions, or web platform issues.
   - 2 = Mentions needing a website, wanting to go online, or frustrated with their current DIY site (Wix, Squarespace, etc.).
   - 1 = Hints at digital presence problems or mentions "need more customers online" without being explicit.
   - 0 = No website-related pain mentioned. General business content, motivational posts, or unrelated topics.

3. Actionability (0-3 points):
   - 3 = Actively asking for recommendations, looking to hire NOW, expressed urgency ("launching next month", "need this done asap").
   - 2 = Clearly exploring options or comparing solutions.
   - 1 = Discussing the problem but hasn't started actively looking for solutions.
   - 0 = Passive observation, thought leadership, or hypothetical musings.

AUTOMATIC ZERO (total_score=1):
- Author is a web developer, designer, or agency SELLING their own services.
- Author is promoting content (blog, newsletter, course, tutorial, thread).
- Author is a student sharing learning progress.
- Author is BUILDING their own website themselves (DIY). If using no-code tools themselves, they are NOT a buyer.
- Author is asking for FEEDBACK or a ROAST on their website/project.
- Author IS a direct competitor (another web studio, freelance developer, web designer).
- Post is about general tech, coding, or software with no clear business website need.
`;

interface RawLead {
    platform: string;
    platformPostId: string;
    authorHandle: string;
    content: string;
    url: string;
    searchContext?: string;
    postedAt?: string | null;
    bio?: string;
    followerCount?: string;
    recentTweets?: string[];
}

interface GradingResult {
    totalScore: number;
    buyingPowerScore: number;
    painAwarenessScore: number;
    actionabilityScore: number;
    qualificationReason: string;
    suggestedIcebreaker: string;
    isBuyer: boolean;
}

function buildUserPayload(lead: RawLead): string {
    const payload: Record<string, any> = {
        platform: lead.platform,
        author_handle: lead.authorHandle,
        search_context: lead.searchContext || "web design",
        triggering_post: lead.content,
    };

    if (lead.bio) payload.bio = lead.bio;
    if (lead.followerCount) payload.follower_count = lead.followerCount;
    if (lead.recentTweets && lead.recentTweets.length > 0) {
        payload.recent_tweets = lead.recentTweets;
    }

    return JSON.stringify(payload, null, 2);
}

// ─── Fix #1 + Fix #3: Structured Outputs + Throw-on-Failure ─────────────────
async function gradeLeadWithGPT(lead: RawLead): Promise<GradingResult> {
    const userPayload = buildUserPayload(lead);

    // Fix #1: openai.chat.completions.parse() guarantees type-safe JSON via Zod
    const completion = await openai.chat.completions.parse({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.15,
        response_format: zodResponseFormat(SDRGradingSchema, "sdr_grading"),
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPayload },
        ],
    });

    const parsed: SDRGrading | null = completion.choices[0]?.message?.parsed ?? null;

    if (!parsed) {
        const refusal = completion.choices[0]?.message?.refusal;
        throw new Error(refusal || "AI returned empty structured output");
    }

    // --- POST-PROCESSING SAFETY NET FOR THE ICEBREAKER ---
    let icebreaker = parsed.suggested_icebreaker;
    // 1. Strip all quotes
    icebreaker = icebreaker.replace(/^["']|["']$/g, "");
    // 2. Physically remove all hyphens/dashes and replace with a space
    icebreaker = icebreaker.replace(/[-—–]/g, " ");
    // 3. Force lowercase to kill robotic capitalization
    icebreaker = icebreaker.toLowerCase();

    return {
        totalScore: parsed.total_score,
        buyingPowerScore: parsed.buying_power_score,
        painAwarenessScore: parsed.pain_awareness_score,
        actionabilityScore: parsed.actionability_score,
        qualificationReason: parsed.qualification_reason,
        suggestedIcebreaker: icebreaker,
        isBuyer: parsed.total_score >= 5,
    };
}

// ─── Fix #3: Retry helpers ──────────────────────────────────────────────────
async function getRetryCount(platformPostId: string): Promise<number> {
    const count = await redis.get(`${RETRY_KEY_PREFIX}${platformPostId}`);
    return count ? parseInt(count, 10) : 0;
}

async function incrementRetryCount(platformPostId: string): Promise<number> {
    const key = `${RETRY_KEY_PREFIX}${platformPostId}`;
    const newCount = await redis.incr(key);
    await redis.expire(key, 60 * 60 * 24); // Expire retry counter after 24h
    return newCount;
}

async function clearRetryCount(platformPostId: string): Promise<void> {
    await redis.del(`${RETRY_KEY_PREFIX}${platformPostId}`);
}

async function startWorker() {
    console.log("🧠 Intent Worker V2 started (SDR + Structured Outputs). Listening...");

    while (true) {
        try {
            const result = await redis.brpop(QUEUE_NAME, 0);

            if (result) {
                const rawLead: RawLead = JSON.parse(result[1]);
                const searchContext = rawLead.searchContext || "software development";
                console.log(`\n📥 Processing: ${rawLead.authorHandle} [context: ${searchContext}]`);

                if (rawLead.bio) console.log(`   📄 Bio: ${rawLead.bio.substring(0, 60)}...`);
                if (rawLead.followerCount) console.log(`   👥 Followers: ${rawLead.followerCount}`);

                try {
                    const grading = await gradeLeadWithGPT(rawLead);

                    console.log(`📊 Score: ${grading.totalScore}/10 | BP:${grading.buyingPowerScore} PA:${grading.painAwarenessScore} AC:${grading.actionabilityScore} | ${grading.isBuyer ? '✅ QUALIFIED' : '❌ UNQUALIFIED'}`);
                    console.log(`📝 ${grading.qualificationReason}`);
                    if (grading.isBuyer) console.log(`💬 Icebreaker: ${grading.suggestedIcebreaker}`);

                    // Fix #2: intentScore = totalScore, founderScore = buyingPowerScore (backward compat for frontend)
                    const savedLead = await prisma.lead.upsert({
                        where: { platformPostId: rawLead.platformPostId },
                        update: {
                            intentScore: grading.totalScore,
                            founderScore: grading.buyingPowerScore, // backward compat
                            buyingPowerScore: grading.buyingPowerScore,
                            painAwarenessScore: grading.painAwarenessScore,
                            actionabilityScore: grading.actionabilityScore,
                            analysis: grading.qualificationReason,
                            suggestedIcebreaker: grading.suggestedIcebreaker,
                            isBuyer: grading.isBuyer,
                            bio: rawLead.bio || null,
                            followerCount: rawLead.followerCount || null,
                            recentTweets: rawLead.recentTweets || [],
                            searchContext,
                            postedAt: rawLead.postedAt ? new Date(rawLead.postedAt) : undefined,
                        },
                        create: {
                            platform: rawLead.platform,
                            platformPostId: rawLead.platformPostId,
                            authorHandle: rawLead.authorHandle,
                            content: rawLead.content,
                            url: rawLead.url,
                            bio: rawLead.bio || null,
                            followerCount: rawLead.followerCount || null,
                            recentTweets: rawLead.recentTweets || [],
                            intentScore: grading.totalScore,
                            founderScore: grading.buyingPowerScore, // backward compat
                            buyingPowerScore: grading.buyingPowerScore,
                            painAwarenessScore: grading.painAwarenessScore,
                            actionabilityScore: grading.actionabilityScore,
                            analysis: grading.qualificationReason,
                            suggestedIcebreaker: grading.suggestedIcebreaker,
                            isBuyer: grading.isBuyer,
                            searchContext,
                            postedAt: rawLead.postedAt ? new Date(rawLead.postedAt) : undefined,
                            status: "detected",
                        },
                    });

                    await clearRetryCount(rawLead.platformPostId);
                    console.log(`✅ Synced Lead: ${rawLead.authorHandle} (${savedLead.id})`);

                } catch (gradingError: any) {
                    // ─── Fix #3: On failure, re-queue lead instead of inserting fake score ─
                    const retryCount = await incrementRetryCount(rawLead.platformPostId);

                    if (retryCount <= MAX_RETRIES) {
                        console.error(`⚠️ GPT failed for ${rawLead.authorHandle} (attempt ${retryCount}/${MAX_RETRIES}): ${gradingError?.message}`);
                        console.log(`   🔄 Re-queuing lead for retry...`);
                        await redis.lpush(QUEUE_NAME, JSON.stringify(rawLead));
                        await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
                    } else {
                        console.error(`❌ PERMANENTLY FAILED after ${MAX_RETRIES} retries: ${rawLead.authorHandle} — ${gradingError?.message}`);
                        console.log(`   🗑️ Dropping lead to prevent infinite loop.`);
                        await clearRetryCount(rawLead.platformPostId);
                    }
                }
            }
        } catch (error: any) {
            console.error("Worker Error:", error?.message || "Unknown error");
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
}

startWorker();