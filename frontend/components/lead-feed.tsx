"use client"

import * as React from "react"
import { IconSortAscending, IconClock, IconFlame, IconChecklist, IconAlertTriangle, IconSearch as IconSearchIcon, IconRefresh } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { LeadCard } from "@/components/lead-card"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

type SortMode = "score" | "recency"

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

interface LeadResponse {
    success: boolean
    data: Lead[]
    total: number
    page: number
    totalPages: number
}

export function LeadFeed() {
    const [leads, setLeads] = React.useState<Lead[]>([])
    const [loading, setLoading] = React.useState(true)
    const [sortMode, setSortMode] = React.useState<SortMode>("score")
    const [buyersOnly, setBuyersOnly] = React.useState(false)
    const [highIntent, setHighIntent] = React.useState(false)
    const [total, setTotal] = React.useState(0)

    const fetchLeads = React.useCallback(async () => {
        setLoading(true)
        try {
            const sortBy = sortMode === "score" ? "intentScore" : "createdAt"
            const res = await fetch(
                `${API_URL}/api/leads?limit=50&sortBy=${sortBy}&sortOrder=desc`,
            )
            const data: LeadResponse = await res.json()
            if (data.success) {
                let filtered = data.data.filter(
                    (lead) => lead.intentScore !== null && lead.intentScore >= 7
                )

                if (buyersOnly) {
                    filtered = filtered.filter(lead => lead.isBuyer === true)
                }

                if (highIntent) {
                    filtered = filtered.filter(lead => (lead.intentScore ?? 0) >= 9)
                }

                setLeads(filtered)
                setTotal(data.total)
            }
        } catch (err) {
            console.error("Failed to fetch leads:", err)
        } finally {
            setLoading(false)
        }
    }, [sortMode, buyersOnly, highIntent])

    React.useEffect(() => {
        fetchLeads()
    }, [fetchLeads])

    // Group leads by searchContext
    const groupedLeads = React.useMemo(() => {
        const groups: Record<string, Lead[]> = {}
        for (const lead of leads) {
            const key = lead.searchContext || "Uncategorized"
            if (!groups[key]) groups[key] = []
            groups[key].push(lead)
        }
        // Sort groups by number of leads (most leads first)
        return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
    }, [leads])

    return (
        <div className="px-4 lg:px-6">
            {/* Header + Filter Controls */}
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">Live Feed</h2>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-muted" onClick={fetchLeads} disabled={loading}>
                            <IconRefresh className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {leads.length} qualified leads (of {total} total) · {groupedLeads.length} {groupedLeads.length === 1 ? 'query' : 'queries'}
                    </p>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
                        <Button
                            size="sm"
                            variant={sortMode === "score" ? "default" : "ghost"}
                            className="h-7 text-xs"
                            onClick={() => setSortMode("score")}
                        >
                            <IconFlame className="mr-1 size-3" />
                            By Score
                        </Button>
                        <Button
                            size="sm"
                            variant={sortMode === "recency" ? "default" : "ghost"}
                            className="h-7 text-xs"
                            onClick={() => setSortMode("recency")}
                        >
                            <IconClock className="mr-1 size-3" />
                            By Recency
                        </Button>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
                        <Button
                            size="sm"
                            variant={buyersOnly ? "default" : "ghost"}
                            className={`h-7 text-xs ${buyersOnly ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                            onClick={() => setBuyersOnly(!buyersOnly)}
                        >
                            <IconChecklist className="mr-1 size-3" />
                            Buyers Only
                        </Button>
                        <Button
                            size="sm"
                            variant={highIntent ? "default" : "ghost"}
                            className={`h-7 text-xs ${highIntent ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                            onClick={() => setHighIntent(!highIntent)}
                        >
                            <IconAlertTriangle className="mr-1 size-3" />
                            Extreme Intent
                        </Button>
                    </div>
                </div>
            </div>

            {/* Lead List — Grouped by Search Query */}
            <div className="flex flex-col gap-6">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-40 w-full rounded-xl" />
                    ))
                ) : leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-16 text-center">
                        <IconSortAscending className="mb-3 size-10 text-muted-foreground/50" />
                        <p className="text-sm font-medium text-muted-foreground">No qualified leads yet</p>
                        <p className="text-xs text-muted-foreground/70">
                            Run your Python scraper or inject a test lead via Redis
                        </p>
                    </div>
                ) : (
                    groupedLeads.map(([queryName, queryLeads]) => (
                        <div key={queryName} className="space-y-3">
                            {/* Query Group Header */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <IconSearchIcon className="size-4 text-blue-400" />
                                    <h3 className="text-sm font-semibold text-foreground">
                                        &ldquo;{queryName}&rdquo;
                                    </h3>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                >
                                    {queryLeads.length} {queryLeads.length === 1 ? 'lead' : 'leads'}
                                </Badge>
                                <div className="h-px flex-1 bg-border/30" />
                            </div>

                            {/* Leads in this group */}
                            <div className="flex flex-col gap-3 pl-2 border-l-2 border-blue-500/20">
                                {queryLeads.map((lead) => (
                                    <LeadCard key={lead.id} lead={lead} />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
