"use client"

import * as React from "react"
import {
    IconSortAscending, IconClock, IconFlame, IconChecklist,
    IconAlertTriangle, IconSearch as IconSearchIcon, IconRefresh,
    IconBrandReddit, IconBrandLinkedin, IconBrandX
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { LeadCard } from "@/components/lead-card"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

type SortMode = "score" | "recency"
type PlatformFilter = "All" | "X" | "LinkedIn" | "Reddit"

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

interface LeadResponse {
    success: boolean
    data: Lead[]
    total: number
    page: number
    totalPages: number
}

// Platform config — colors, icons, labels
const PLATFORM_CONFIG: Record<string, {
    label: string
    icon: React.ReactNode
    headerBg: string
    headerBorder: string
    headerText: string
    badgeBg: string
    borderAccent: string
}> = {
    Reddit: {
        label: "Reddit",
        icon: <IconBrandReddit className="size-4" />,
        headerBg: "bg-orange-500/10",
        headerBorder: "border-orange-500/30",
        headerText: "text-orange-400",
        badgeBg: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        borderAccent: "border-orange-500/30",
    },
    LinkedIn: {
        label: "LinkedIn",
        icon: <IconBrandLinkedin className="size-4" />,
        headerBg: "bg-blue-500/10",
        headerBorder: "border-blue-500/30",
        headerText: "text-blue-400",
        badgeBg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        borderAccent: "border-blue-500/30",
    },
    X: {
        label: "X / Twitter",
        icon: <IconBrandX className="size-4" />,
        headerBg: "bg-zinc-500/10",
        headerBorder: "border-zinc-500/30",
        headerText: "text-zinc-300",
        badgeBg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
        borderAccent: "border-zinc-600",
    },
}

function sortLeads(leads: Lead[], sortMode: SortMode): Lead[] {
    return [...leads].sort((a, b) => {
        if (sortMode === "score") {
            // Push null-scored leads to the bottom
            const aScore = a.intentScore ?? -1
            const bScore = b.intentScore ?? -1
            return bScore - aScore
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
}

export function LeadFeed() {
    const [leads, setLeads] = React.useState<Lead[]>([])
    const [loading, setLoading] = React.useState(true)
    const [sortMode, setSortMode] = React.useState<SortMode>("score")
    const [buyersOnly, setBuyersOnly] = React.useState(false)
    const [highIntent, setHighIntent] = React.useState(false)
    const [total, setTotal] = React.useState(0)
    const [platformFilter, setPlatformFilter] = React.useState<PlatformFilter>("All")

    const fetchLeads = React.useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                limit: "100",
                sortBy: "createdAt",
                sortOrder: "desc",
            })
            if (buyersOnly) params.set("isBuyer", "true")

            const res = await fetch(`${API_URL}/api/leads?${params.toString()}`)
            const data: LeadResponse = await res.json()
            if (data.success) {
                let results = data.data
                if (highIntent) results = results.filter(l => (l.intentScore ?? 0) >= 9)
                setLeads(results)
                setTotal(data.total)
            }
        } catch (err) {
            console.error("Failed to fetch leads:", err)
        } finally {
            setLoading(false)
        }
    }, [buyersOnly, highIntent])

    React.useEffect(() => { fetchLeads() }, [fetchLeads])

    // Build platform → query → leads structure
    const platformGroups = React.useMemo(() => {
        const platformOrder = ["Reddit", "LinkedIn", "X"]
        const grouped: Record<string, Record<string, Lead[]>> = {}

        for (const lead of leads) {
            const platform = lead.platform || "X"
            if (platformFilter !== "All" && platform !== platformFilter) continue

            const query = lead.searchContext || "Uncategorized"
            if (!grouped[platform]) grouped[platform] = {}
            if (!grouped[platform][query]) grouped[platform][query] = []
            grouped[platform][query].push(lead)
        }

        // Sort each platform's queries and leads
        return platformOrder
            .filter(p => grouped[p])
            .map(platform => {
                const queries = Object.entries(grouped[platform]).map(([query, queryLeads]) => ({
                    query,
                    leads: sortLeads(queryLeads, sortMode),
                }))

                // Sort queries by best lead score within them
                queries.sort((a, b) => {
                    if (sortMode === "score") {
                        const bestA = Math.max(...a.leads.map(l => l.intentScore ?? -1))
                        const bestB = Math.max(...b.leads.map(l => l.intentScore ?? -1))
                        return bestB - bestA
                    }
                    const latestA = Math.max(...a.leads.map(l => new Date(l.createdAt).getTime()))
                    const latestB = Math.max(...b.leads.map(l => new Date(l.createdAt).getTime()))
                    return latestB - latestA
                })

                const totalLeads = queries.reduce((sum, q) => sum + q.leads.length, 0)
                return { platform, queries, totalLeads }
            })
    }, [leads, sortMode, platformFilter])

    const totalVisible = platformGroups.reduce((sum, pg) => sum + pg.totalLeads, 0)

    return (
        <div className="px-4 lg:px-6">
            {/* ── Header + Controls ─────────────────────────────────── */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">Live Feed</h2>
                        <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 rounded-full hover:bg-muted"
                            onClick={fetchLeads} disabled={loading}
                        >
                            <IconRefresh className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {totalVisible} leads shown · {total} total · {platformGroups.length} {platformGroups.length === 1 ? "source" : "sources"}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Sort */}
                    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
                        <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 text-xs transition-all ${sortMode === "score" ? "bg-zinc-700 text-white hover:bg-zinc-600" : "text-muted-foreground"}`}
                            onClick={() => setSortMode("score")}
                        >
                            <IconFlame className="mr-1 size-3" /> By Score
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 text-xs transition-all ${sortMode === "recency" ? "bg-zinc-700 text-white hover:bg-zinc-600" : "text-muted-foreground"}`}
                            onClick={() => setSortMode("recency")}
                        >
                            <IconClock className="mr-1 size-3" /> By Recency
                        </Button>
                    </div>

                    {/* Quality Filters */}
                    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
                        <Button
                            size="sm" variant="ghost"
                            className={`h-7 text-xs transition-all ${buyersOnly ? "bg-blue-600 text-white hover:bg-blue-700" : "text-muted-foreground"}`}
                            onClick={() => setBuyersOnly(!buyersOnly)}
                        >
                            <IconChecklist className="mr-1 size-3" /> Buyers Only
                        </Button>
                        <Button
                            size="sm" variant="ghost"
                            className={`h-7 text-xs transition-all ${highIntent ? "bg-orange-600 text-white hover:bg-orange-700" : "text-muted-foreground"}`}
                            onClick={() => setHighIntent(!highIntent)}
                        >
                            <IconAlertTriangle className="mr-1 size-3" /> Extreme Intent
                        </Button>
                    </div>

                    {/* Platform Filter */}
                    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
                        {(["All", "Reddit", "LinkedIn", "X"] as PlatformFilter[]).map(p => (
                            <Button
                                key={p}
                                size="sm" variant="ghost"
                                className={`h-7 text-xs transition-all ${platformFilter === p
                                    ? p === "Reddit" ? "bg-orange-600 text-white hover:bg-orange-700"
                                        : p === "LinkedIn" ? "bg-blue-600 text-white hover:bg-blue-700"
                                            : "bg-zinc-700 text-white hover:bg-zinc-600"
                                    : "text-muted-foreground"
                                    }`}
                                onClick={() => setPlatformFilter(p)}
                            >
                                {p}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Feed ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-8">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-48 w-full rounded-xl" />
                    ))
                ) : platformGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-20 text-center">
                        <IconSortAscending className="mb-3 size-10 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">No qualified leads yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Select a platform and run a scrape from the panel above
                        </p>
                    </div>
                ) : (
                    platformGroups.map(({ platform, queries, totalLeads }) => {
                        const config = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG["X"]
                        return (
                            <div key={platform} className="flex flex-col gap-4">

                                {/* ── Platform Header ───────────────── */}
                                <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${config.headerBg} ${config.headerBorder}`}>
                                    <span className={config.headerText}>{config.icon}</span>
                                    <span className={`text-sm font-bold ${config.headerText}`}>{config.label}</span>
                                    <Badge className={`text-[10px] border ${config.badgeBg}`}>
                                        {totalLeads} {totalLeads === 1 ? "lead" : "leads"}
                                    </Badge>
                                    <div className="h-px flex-1 bg-border/20" />
                                </div>

                                {/* ── Query Groups within Platform ───── */}
                                <div className="flex flex-col gap-6 pl-2">
                                    {queries.map(({ query, leads: queryLeads }) => (
                                        <div key={query} className="flex flex-col gap-3">

                                            {/* Query sub-header */}
                                            <div className="flex items-center gap-2">
                                                <IconSearchIcon className={`size-3.5 ${config.headerText}`} />
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    &ldquo;{query}&rdquo;
                                                </span>
                                                <Badge variant="secondary" className={`text-[10px] border ${config.badgeBg}`}>
                                                    {queryLeads.length} {queryLeads.length === 1 ? "lead" : "leads"}
                                                </Badge>
                                                <div className="h-px flex-1 bg-border/20" />
                                            </div>

                                            {/* Lead Cards */}
                                            <div className={`flex flex-col gap-3 pl-3 border-l-2 ${config.borderAccent}`}>
                                                {queryLeads.map(lead => (
                                                    <LeadCard key={lead.id} lead={lead} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
