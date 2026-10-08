"use client"

import * as React from "react"
import { IconExternalLink, IconSparkles, IconCopy, IconCheck, IconLoader2, IconMail, IconMessageCircle, IconCircleCheck } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

interface Lead {
    id: string
    platform: string
    platformPostId: string
    authorHandle: string
    content: string
    url: string
    intentScore: number | null
    founderScore: number | null
    analysis: string | null
    isBuyer: boolean | null
    searchContext: string | null
    postedAt: string | null
    status: string
    createdAt: string
    bio?: string | null
    followerCount?: string | null
    recentTweets?: any[] | null
    buyingPowerScore?: number | null
    painAwarenessScore?: number | null
    actionabilityScore?: number | null
    suggestedIcebreaker?: string | null
}

function getRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "unknown"
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
}

function getIntentGlow(score: number | null) {
    if (!score) return "bg-zinc-800/60 text-zinc-500 border-zinc-700"
    if (score >= 8) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
    if (score >= 5) return "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
    return "bg-zinc-800/60 text-zinc-400 border-zinc-700"
}

const STATUS_CONFIG = {
    detected:   { label: "New",        className: "bg-zinc-800 text-zinc-400 border-zinc-700" },
    contacted:  { label: "Contacted",  className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    replied:    { label: "Replied",    className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    closed:     { label: "Closed ✓",  className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
} as const

type LeadStatus = keyof typeof STATUS_CONFIG

export function LeadCard({ lead }: { lead: Lead }) {
    const [reply, setReply] = React.useState<string | null>(null)
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [copied, setCopied] = React.useState(false)
    const isReddit = lead.platform === "Reddit"
    const isX = lead.platform === "X"
    const isLinkedIn = lead.platform === "LinkedIn"
    const [replyStyle, setReplyStyle] = React.useState<"helpful" | "authoritative" | "witty" | "story" | "question">(
        isReddit ? "story" : isX ? "authoritative" : "helpful"
    )
    const [status, setStatus] = React.useState<LeadStatus>((lead.status as LeadStatus) || "detected")
    const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false)
    const [expanded, setExpanded] = React.useState(false)

    const WORD_LIMIT = 40
    const words = lead.content.split(/\s+/)
    const isTruncated = words.length > WORD_LIMIT
    const displayContent = expanded || !isTruncated ? lead.content : words.slice(0, WORD_LIMIT).join(" ") + "…"

    async function handleStatusChange(newStatus: LeadStatus) {
        if (newStatus === status) return
        setIsUpdatingStatus(true)
        try {
            await fetch(`${API_URL}/api/leads/${lead.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            setStatus(newStatus)
        } catch (err) {
            console.error("Failed to update status:", err)
        } finally {
            setIsUpdatingStatus(false)
        }
    }

    async function handleGenerateReply() {
        setIsGenerating(true)
        setReply(null)
        try {
            const res = await fetch(`${API_URL}/api/leads/${lead.id}/generate-reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ replyStyle }),
            })
            const data = await res.json()
            if (data.success) {
                setReply(data.data.suggestedText)
            }
        } catch (err) {
            console.error("Failed to generate reply:", err)
        } finally {
            setIsGenerating(false)
        }
    }

    async function handleCopyIcebreaker() {
        if (!lead.suggestedIcebreaker) return
        await navigator.clipboard.writeText(lead.suggestedIcebreaker)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    async function handleCopyReply() {
        if (!reply) return
        await navigator.clipboard.writeText(reply)
    }

    const postTime = lead.postedAt || lead.createdAt
    const bp = lead.buyingPowerScore ?? 0
    const pa = lead.painAwarenessScore ?? 0
    const ac = lead.actionabilityScore ?? 0

    return (
        <div className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-[#121212] transition-all hover:border-zinc-700 hover:shadow-lg hover:shadow-black/30">

            {/* ── Header ───────────────────────────────────────────── */}
            <div className="p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                    {/* Author Info */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-300">
                                {lead.authorHandle?.[1]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                                <a
                                    href={lead.platform === 'LinkedIn' ? `https://www.linkedin.com/in/${lead.authorHandle.replace("@", "")}` : lead.platform === 'Reddit' ? `https://www.reddit.com/${lead.authorHandle}` : `https://x.com/${lead.authorHandle.replace("@", "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-semibold text-zinc-200 hover:text-blue-400 transition-colors"
                                >
                                    {lead.authorHandle}
                                </a>
                                <p className="text-xs text-zinc-500">
                                    <span className={lead.platform === "LinkedIn" ? "text-blue-400 font-medium" : ""}>{lead.platform}</span> · {getRelativeTime(postTime)}
                                    {lead.followerCount && lead.followerCount !== "Hidden" && <span> · {lead.followerCount} followers</span>}
                                </p>
                            </div>
                        </div>
                        {lead.bio && (
                            <p className="mt-2 text-xs text-zinc-400 line-clamp-1">{lead.bio}</p>
                        )}
                    </div>

                    {/* Intent Score Pill */}
                    <div className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold tabular-nums ${getIntentGlow(lead.intentScore)}`}>
                        🎯 {lead.intentScore ?? 0}/10
                    </div>
                </div>
            </div>

            {/* ── V2 Sub-Score Matrix ──────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                <div className={`rounded-lg border px-2.5 py-1.5 text-center text-[11px] font-medium ${bp >= 3
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-800 bg-zinc-900 text-zinc-500"
                    }`}>
                    <span className="block text-[10px] uppercase tracking-wider opacity-70">Buying Power</span>
                    <span className="text-sm font-bold">{bp}/4</span>
                </div>
                <div className={`rounded-lg border px-2.5 py-1.5 text-center text-[11px] font-medium ${pa >= 2
                    ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
                    : "border-zinc-800 bg-zinc-900 text-zinc-500"
                    }`}>
                    <span className="block text-[10px] uppercase tracking-wider opacity-70">Pain</span>
                    <span className="text-sm font-bold">{pa}/3</span>
                </div>
                <div className={`rounded-lg border px-2.5 py-1.5 text-center text-[11px] font-medium ${ac >= 2
                    ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                    : "border-zinc-800 bg-zinc-900 text-zinc-500"
                    }`}>
                    <span className="block text-[10px] uppercase tracking-wider opacity-70">Actionability</span>
                    <span className="text-sm font-bold">{ac}/3</span>
                </div>
            </div>

            {/* ── Content & AI Analysis ───────────────────────────── */}
            <div className="px-4 pb-3">
                <p className="text-sm italic leading-relaxed text-zinc-300">
                    &ldquo;{displayContent}&rdquo;
                </p>
                {isTruncated && (
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="mt-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        {expanded ? "Show less ↑" : "Read more ↓"}
                    </button>
                )}

                {lead.analysis && (
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-black/40 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                            🤖 AI Analysis
                        </p>
                        <p className="text-xs leading-relaxed text-zinc-400">
                            {lead.analysis}
                        </p>
                    </div>
                )}
            </div>

            {/* ── Icebreaker / Suggested Comment ──────────────────── */}
            {lead.isBuyer && lead.suggestedIcebreaker && (() => {
                const cfg = isReddit
                    ? { bg: "bg-orange-950/20", labelColor: "text-orange-400/70", borderColor: "border-orange-500/10", contentBg: "bg-orange-950/30", textColor: "text-orange-200", btnColor: "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10", label: "💬 Suggested Comment", copyLabel: "Copy Comment", hint: "Post this as a public reply in the thread — don't DM." }
                    : isX
                    ? { bg: "bg-zinc-900/60", labelColor: "text-zinc-400/70", borderColor: "border-zinc-700/40", contentBg: "bg-zinc-900", textColor: "text-zinc-300", btnColor: "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50", label: "💬 Twitter DM", copyLabel: "Copy DM", hint: "Note: X DMs require them to follow you or have open DMs." }
                    : { bg: "bg-indigo-950/20", labelColor: "text-indigo-400/70", borderColor: "border-indigo-500/10", contentBg: "bg-indigo-950/30", textColor: "text-indigo-300", btnColor: "text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10", label: "💬 LinkedIn DM", copyLabel: "Copy DM", hint: null }
                return (
                    <div className={`border-t border-zinc-800 px-4 py-3 ${cfg.bg}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${cfg.labelColor}`}>
                            {cfg.label}
                        </p>
                        {cfg.hint && (
                            <p className={`text-[10px] mb-2 ${cfg.labelColor} opacity-70`}>{cfg.hint}</p>
                        )}
                        <div className="flex items-start gap-2">
                            <p className={`flex-1 rounded-md border px-3 py-2 text-xs leading-relaxed ${cfg.borderColor} ${cfg.contentBg} ${cfg.textColor}`}>
                                {lead.suggestedIcebreaker}
                            </p>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCopyIcebreaker}
                                className={`h-8 shrink-0 text-xs transition-all ${copied ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20" : cfg.btnColor}`}
                            >
                                {copied
                                    ? <><IconCheck className="mr-1 size-3" /> Copied! ✓</>
                                    : <><IconCopy className="mr-1 size-3" /> {cfg.copyLabel}</>
                                }
                            </Button>
                        </div>
                    </div>
                )
            })()}

            {/* ── Status Tracker ──────────────────────────────────── */}
            <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-2.5 bg-zinc-950/40">
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mr-1">Status</span>
                <Badge className={`text-[10px] border px-2 py-0.5 ${STATUS_CONFIG[status].className}`}>
                    {STATUS_CONFIG[status].label}
                </Badge>
                <div className="flex items-center gap-1 ml-1">
                    <button
                        onClick={() => handleStatusChange("contacted")}
                        disabled={isUpdatingStatus}
                        title="Mark as Contacted"
                        className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors flex items-center gap-1 ${status === "contacted" ? "bg-blue-500/20 text-blue-400" : "text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10"}`}
                    >
                        <IconMail className="size-3" /> Contacted
                    </button>
                    <button
                        onClick={() => handleStatusChange("replied")}
                        disabled={isUpdatingStatus}
                        title="Mark as Replied"
                        className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors flex items-center gap-1 ${status === "replied" ? "bg-amber-500/20 text-amber-400" : "text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"}`}
                    >
                        <IconMessageCircle className="size-3" /> Replied
                    </button>
                    <button
                        onClick={() => handleStatusChange("closed")}
                        disabled={isUpdatingStatus}
                        title="Mark as Closed / Won"
                        className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors flex items-center gap-1 ${status === "closed" ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10"}`}
                    >
                        <IconCircleCheck className="size-3" /> Closed
                    </button>
                </div>
            </div>

            {/* ── Footer: Generate Reply + Open in X ─────────────── */}
            <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-2.5 bg-zinc-900/50">
                {/* AI Reply Display */}
                {reply && (
                    <div className="flex-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-medium text-emerald-400">
                                {isReddit ? "✨ Comment Draft" : isX ? "✨ Tweet Draft" : "✨ Reply Draft"}
                            </p>
                            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] text-zinc-400" onClick={handleCopyReply}>
                                <IconCopy className="size-2.5 mr-0.5" /> Copy
                            </Button>
                        </div>
                        <p className="text-xs text-zinc-300">{reply}</p>
                    </div>
                )}

                {!reply && (
                    <>
                        <select
                            className="h-7 text-[11px] bg-zinc-900 border border-zinc-800 rounded-md px-1.5 text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                            value={replyStyle}
                            onChange={(e) => setReplyStyle(e.target.value as any)}
                            disabled={isGenerating}
                        >
                            {isReddit ? (
                                <>
                                    <option value="story">Share Story</option>
                                    <option value="helpful">Helpful Advice</option>
                                    <option value="question">Ask a Question</option>
                                </>
                            ) : isX ? (
                                <>
                                    <option value="authoritative">Call It Out</option>
                                    <option value="witty">Witty</option>
                                    <option value="helpful">Helpful</option>
                                </>
                            ) : (
                                <>
                                    <option value="helpful">Helpful</option>
                                    <option value="story">Share Story</option>
                                    <option value="authoritative">Authoritative</option>
                                </>
                            )}
                        </select>
                        <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 text-[11px] hover:bg-zinc-800 ${
                                isReddit ? "text-orange-400 hover:text-orange-300"
                                : isX ? "text-zinc-300 hover:text-white"
                                : "text-blue-400 hover:text-blue-300"
                            }`}
                            onClick={handleGenerateReply}
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <><IconLoader2 className="mr-1 size-3 animate-spin" /> Generating...</>
                            ) : (
                                <><IconSparkles className="mr-1 size-3" />
                                {isReddit ? "Generate Comment" : isX ? "Tweet Reply" : "Generate Reply"}</>
                            )}
                        </Button>
                    </>
                )}

                <div className="flex-1" />
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                    asChild
                >
                    <a href={lead.url} target="_blank" rel="noopener noreferrer">
                        <IconExternalLink className="mr-1 size-3" />
                        Open in {lead.platform === 'LinkedIn' ? 'LinkedIn' : lead.platform === 'Reddit' ? 'Reddit' : 'X'} ↗
                    </a>
                </Button>
            </div>
        </div>
    )
}
