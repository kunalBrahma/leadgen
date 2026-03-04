"use client"

import * as React from "react"
import { IconExternalLink, IconSparkles, IconCopy, IconCheck, IconLoader2 } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardFooter } from "@/components/ui/card"

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

function getFreshnessColor(dateStr: string | null): string {
    if (!dateStr) return "text-muted-foreground"
    const diffMs = new Date().getTime() - new Date(dateStr).getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 6) return "text-emerald-400"
    if (diffHours < 24) return "text-amber-400"
    if (diffHours < 72) return "text-orange-400"
    return "text-red-400"
}

function getScoreColor(score: number | null): string {
    if (!score) return "bg-muted text-muted-foreground"
    if (score >= 8) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    if (score >= 6) return "bg-amber-500/15 text-amber-400 border-amber-500/30"
    return "bg-red-500/15 text-red-400 border-red-500/30"
}

export function LeadCard({ lead }: { lead: Lead }) {
    const [reply, setReply] = React.useState<string | null>(null)
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [copied, setCopied] = React.useState(false)
    const [replyStyle, setReplyStyle] = React.useState<"helpful" | "authoritative" | "witty">("helpful")

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

    async function handleCopy() {
        if (!reply) return
        await navigator.clipboard.writeText(reply)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const postTime = lead.postedAt || lead.createdAt

    return (
        <Card className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg hover:shadow-primary/5">
            <CardHeader className="pb-3">
                {/* Header: Author + Time + Scores */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {lead.authorHandle?.[1]?.toUpperCase() || "?"}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">{lead.authorHandle}</p>
                            <p className={`text-xs ${getFreshnessColor(postTime)}`}>
                                {lead.platform} · Posted {getRelativeTime(postTime)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-xs font-mono ${getScoreColor(lead.intentScore)}`}>
                            🎯 {lead.intentScore ?? 0}/10
                        </Badge>
                        <Badge variant="outline" className={`text-xs font-mono ${getScoreColor(lead.founderScore)}`}>
                            👤 {lead.founderScore ?? 0}/10
                        </Badge>
                        {lead.isBuyer && (
                            <Badge className="bg-blue-600 text-[10px] font-bold uppercase tracking-wider text-white border-none shadow-sm shadow-blue-900/40">
                                Verified Buyer
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Content */}
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                    {lead.content}
                </p>

                {/* AI Analysis */}
                {lead.analysis && (
                    <div className="mt-4 rounded-md border border-border/40 bg-muted/20 p-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                            AI Context & Analysis
                        </p>
                        <p className="mt-1 text-xs italic leading-relaxed text-muted-foreground">
                            &ldquo;{lead.analysis}&rdquo;
                        </p>
                    </div>
                )}
            </CardHeader>

            {/* AI Reply Section */}
            {reply && (
                <div className="mx-6 mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-emerald-400">✨ AI-Generated Reply</p>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={handleCopy}
                        >
                            {copied ? (
                                <><IconCheck className="mr-1 size-3" /> Copied!</>
                            ) : (
                                <><IconCopy className="mr-1 size-3" /> Copy</>
                            )}
                        </Button>
                    </div>
                    <p className="text-sm text-foreground/80">{reply}</p>
                </div>
            )}

            <CardFooter className="flex gap-2 pt-0 items-center">
                <select
                    className="h-8 text-xs bg-background border border-border/50 rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    value={replyStyle}
                    onChange={(e) => setReplyStyle(e.target.value as any)}
                    disabled={isGenerating}
                >
                    <option value="helpful">Style: Helpful</option>
                    <option value="authoritative">Style: Authoritative</option>
                    <option value="witty">Style: Witty</option>
                </select>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={handleGenerateReply}
                    disabled={isGenerating}
                >
                    {isGenerating ? (
                        <><IconLoader2 className="mr-1 size-3 animate-spin" /> Generating...</>
                    ) : (
                        <><IconSparkles className="mr-1 size-3" /> Generate Reply</>
                    )}
                </Button>
                <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs"
                    asChild
                >
                    <a href={lead.url} target="_blank" rel="noopener noreferrer">
                        <IconExternalLink className="mr-1 size-3" />
                        Open in X
                    </a>
                </Button>
            </CardFooter>
        </Card>
    )
}
