"use client"

import * as React from "react"
import { IconTargetArrow, IconFlame, IconTrendingUp, IconBolt, IconPlus, IconX } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

interface Stats {
    total: number
    hotLeads: number
    avgIntent: number
    buyerCount: number
}

export function SectionStats() {
    const [stats, setStats] = React.useState<Stats>({ total: 0, hotLeads: 0, avgIntent: 0, buyerCount: 0 })
    const [isScraping, setIsScraping] = React.useState(false)
    const [queryInput, setQueryInput] = React.useState("")
    const [queries, setQueries] = React.useState<string[]>([])
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [platform, setPlatform] = React.useState<"X" | "LinkedIn" | "Reddit">("X")

    const fetchStats = React.useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/leads/stats`)
            const data = await res.json()
            if (data.success && data.data) {
                setStats({
                    total: data.data.total || 0,
                    hotLeads: data.data.hotLeads || 0,
                    avgIntent: data.data.avgIntent || 0,
                    buyerCount: data.data.buyerCount || 0
                })
            }
        } catch (err) {
            console.error("Failed to fetch stats:", err)
        }
    }, [])

    const fetchQueries = React.useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/queries`)
            const data = await res.json()
            if (data.success && data.queries) {
                setQueries(data.queries)
            }
        } catch (err) {
            console.error("Failed to fetch active queries:", err)
        }
    }, [])

    React.useEffect(() => {
        fetchStats()
        fetchQueries()
    }, [fetchStats, fetchQueries])

    const handleDeleteAll = async () => {
        if (!confirm("Are you sure you want to delete ALL leads? This cannot be undone.")) return;
        setIsDeleting(true);
        try {
            await fetch(`${API_URL}/api/leads`, { method: "DELETE" });
            toast.success("Successfully deleted all leads.");
            fetchStats();
            window.location.reload(); // Quick way to sync the feed below
        } catch (err) {
            console.error("Failed to delete leads:", err);
            toast.error("Failed to delete leads");
        } finally {
            setIsDeleting(false);
        }
    }

    const addQuery = () => {
        const trimmed = queryInput.trim()
        if (!trimmed) return
        if (queries.includes(trimmed)) {
            toast.warning("This query is already in the list.")
            return
        }
        setQueries((prev) => [...prev, trimmed])
        setQueryInput("")
    }

    const removeQuery = (index: number) => {
        setQueries((prev) => prev.filter((_, i) => i !== index))
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            addQuery()
        }
    }

    const handleManualScrape = async () => {
        if (isScraping) return;

        if (queries.length === 0) {
            toast.warning("Add at least one target query before scraping.")
            return
        }

        setIsScraping(true);
        toast.info(`Scraper deployed with ${queries.length} target ${queries.length === 1 ? 'query' : 'queries'}! Hunting in the background...`, {
            duration: 5000,
        });

        try {
            // Persist the queries first
            await fetch(`${API_URL}/api/queries`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ queries }),
            });

            // Start scraper
            await fetch(`${API_URL}/api/scrape`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ queries, platform }),
            });

            // Poll the backend for new stats every 5s to detect when scraping finishes
            const pollInterval = setInterval(async () => {
                try {
                    const res = await fetch(`${API_URL}/api/leads/stats`)
                    const data = await res.json()
                    if (data.success && data.data && data.data.total > stats.total) {
                        clearInterval(pollInterval)
                        setIsScraping(false)
                        toast.success("New leads detected! Scrape cycle finished.")
                        fetchStats()
                        window.location.reload()
                    }
                } catch { /* ignore polling errors */ }
            }, 5000)

            // Safety timeout: stop polling after 2 minutes
            setTimeout(() => {
                clearInterval(pollInterval)
                setIsScraping(false)
                toast.info("Scrape timeout reached. Check backend logs.")
                fetchStats()
            }, 120000)

        } catch (error) {
            console.error("Failed to trigger scraper", error);
            toast.error("Failed to start scraper. Check backend logs.");
            setIsScraping(false);
        }
    };

    return (
        <div className="space-y-4 px-4 lg:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
                <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs bg-red-600 hover:bg-red-700"
                    onClick={handleDeleteAll}
                    disabled={isDeleting || isScraping}
                >
                    <IconX className="mr-1 size-3.5" />
                    {isDeleting ? "Deleting..." : "Clear All Leads"}
                </Button>
            </div>

            {/* Query Builder Section */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Target Queries</p>
                    <span className="text-xs text-muted-foreground">{queries.length} active</span>
                </div>

                {/* Input Row */}
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="e.g. 'need a website', 'website redesign', 'looking for web designer'..."
                        className="h-9 flex-1 text-xs bg-background border-border/50 focus:border-blue-500/50"
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isScraping}
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-9 gap-1.5 border-border/50 hover:bg-blue-600/10 hover:text-blue-500 hover:border-blue-500/30"
                        onClick={addQuery}
                        disabled={isScraping || !queryInput.trim()}
                    >
                        <IconPlus className="size-3.5" />
                        Add Query
                    </Button>
                </div>

                {/* Tags */}
                {queries.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {queries.map((q, i) => (
                            <Badge
                                key={i}
                                variant="secondary"
                                className="gap-1.5 py-1 pl-2.5 pr-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                            >
                                {q}
                                <button
                                    className="ml-0.5 rounded-full p-0.5 hover:bg-blue-500/30 transition-colors"
                                    onClick={() => removeQuery(i)}
                                    disabled={isScraping}
                                >
                                    <IconX className="size-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Scrape Button Row */}
                <div className="flex items-center gap-2">
                    <select
                        className="h-10 rounded-md border border-border/50 bg-background px-3 text-sm focus:border-blue-500/50 focus:outline-none"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value as "X" | "LinkedIn" | "Reddit")}
                        disabled={isScraping}
                    >
                        <option value="X">X (Twitter)</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Reddit">Reddit</option>
                    </select>

                    <Button
                        onClick={handleManualScrape}
                        disabled={isScraping || queries.length === 0}
                        variant={isScraping ? "secondary" : "default"}
                        className={`flex-1 gap-2 ${!isScraping && queries.length > 0 ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20" : ""}`}
                    >
                        {isScraping ? (
                            <>
                                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Scraping Active...
                            </>
                        ) : (
                            <>
                                <IconBolt className="size-4 fill-current" />
                                Force Scrape {platform} ({queries.length} {queries.length === 1 ? 'query' : 'queries'})
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-4">
                <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
                    <CardHeader>
                        <CardDescription>Total Leads Detected</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {stats.total}
                        </CardTitle>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="flex gap-2 font-medium text-muted-foreground">
                            <IconTargetArrow className="size-4" />
                            Across all platforms
                        </div>
                    </CardFooter>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-emerald-500/5 to-card shadow-xs">
                    <CardHeader>
                        <CardDescription>Hot Leads (Score ≥ 7)</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums text-emerald-400 @[250px]/card:text-3xl">
                            {stats.hotLeads}
                        </CardTitle>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="flex gap-2 font-medium text-emerald-400/70">
                            <IconFlame className="size-4" />
                            Ready to engage
                        </div>
                    </CardFooter>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-amber-500/5 to-card shadow-xs">
                    <CardHeader>
                        <CardDescription>Avg Intent Score</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums text-amber-400 @[250px]/card:text-3xl">
                            {stats.avgIntent}/10
                        </CardTitle>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="flex gap-2 font-medium text-amber-400/70">
                            <IconTrendingUp className="size-4" />
                            Lead quality indicator
                        </div>
                    </CardFooter>
                </Card>

                <Card className="@container/card bg-gradient-to-t from-blue-500/5 to-card shadow-xs">
                    <CardHeader>
                        <CardDescription>Verified Buyers</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums text-blue-400 @[250px]/card:text-3xl">
                            {stats.buyerCount}
                        </CardTitle>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="flex gap-2 font-medium text-blue-400/70">
                            <IconFlame className="size-4" />
                            AI-qualified prospects
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
