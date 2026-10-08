"use client"

import * as React from "react"
import { IconPlus, IconX, IconLoader2, IconBrandReddit, IconSearch } from "@tabler/icons-react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { toast } from "sonner"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

function TagManager({
    items,
    onAdd,
    onRemove,
    placeholder,
    loading,
    saving,
    color = "blue",
}: {
    items: string[]
    onAdd: (val: string) => void
    onRemove: (val: string) => void
    placeholder: string
    loading: boolean
    saving: boolean
    color?: "blue" | "orange"
}) {
    const [input, setInput] = React.useState("")

    const handleAdd = () => {
        const trimmed = input.trim().replace(/^r\//, "") // strip leading r/ if pasted
        if (!trimmed) return
        onAdd(trimmed)
        setInput("")
    }

    const badgeClass = color === "orange"
        ? "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20"
        : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <Input
                    placeholder={placeholder}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    className="flex-1 text-sm"
                    disabled={saving}
                />
                <Button onClick={handleAdd} disabled={saving || !input.trim()} size="sm">
                    {saving
                        ? <IconLoader2 className="mr-1 size-4 animate-spin" />
                        : <IconPlus className="mr-1 size-4" />}
                    Add
                </Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                ) : items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing configured yet. Add one above.</p>
                ) : (
                    items.map((item, idx) => (
                        <Badge
                            key={idx}
                            variant="outline"
                            className={`gap-1 py-1.5 pl-3 pr-1.5 text-sm border ${badgeClass}`}
                        >
                            {item}
                            <button
                                onClick={() => onRemove(item)}
                                disabled={saving}
                                className="ml-1 rounded-full p-0.5 transition-colors hover:bg-destructive/20 hover:text-destructive"
                            >
                                <IconX className="size-3" />
                            </button>
                        </Badge>
                    ))
                )}
            </div>
        </div>
    )
}

export default function SettingsPage() {
    // Keywords state
    const [queries, setQueries] = React.useState<string[]>([])
    const [queriesLoading, setQueriesLoading] = React.useState(true)
    const [queriesSaving, setQueriesSaving] = React.useState(false)

    // Subreddits state
    const [subreddits, setSubreddits] = React.useState<string[]>([])
    const [subredditsLoading, setSubredditsLoading] = React.useState(true)
    const [subredditsSaving, setSubredditsSaving] = React.useState(false)

    // Fetch both on mount
    React.useEffect(() => {
        fetch(`${API_URL}/api/queries`)
            .then(r => r.json())
            .then(d => { if (d.success) setQueries(d.queries || []) })
            .catch(() => toast.error("Failed to load keywords"))
            .finally(() => setQueriesLoading(false))

        fetch(`${API_URL}/api/queries/subreddits`)
            .then(r => r.json())
            .then(d => { if (d.success) setSubreddits(d.subreddits || []) })
            .catch(() => toast.error("Failed to load subreddits"))
            .finally(() => setSubredditsLoading(false))
    }, [])

    // Keywords handlers
    async function saveQueries(updated: string[]) {
        setQueriesSaving(true)
        try {
            const res = await fetch(`${API_URL}/api/queries`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ queries: updated }),
            })
            if ((await res.json()).success) toast.success("Keywords saved.")
            else toast.error("Failed to save keywords")
        } catch { toast.error("Failed to save keywords") }
        finally { setQueriesSaving(false) }
    }

    const handleAddQuery = (val: string) => {
        if (queries.includes(val)) { toast.warning("Already in list."); return }
        const updated = [...queries, val]
        setQueries(updated)
        saveQueries(updated)
    }

    const handleRemoveQuery = (val: string) => {
        const updated = queries.filter(q => q !== val)
        setQueries(updated)
        saveQueries(updated)
    }

    // Subreddit handlers
    async function saveSubreddits(updated: string[]) {
        setSubredditsSaving(true)
        try {
            const res = await fetch(`${API_URL}/api/queries/subreddits`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subreddits: updated }),
            })
            if ((await res.json()).success) toast.success("Subreddits saved.")
            else toast.error("Failed to save subreddits")
        } catch { toast.error("Failed to save subreddits") }
        finally { setSubredditsSaving(false) }
    }

    const handleAddSubreddit = (val: string) => {
        if (subreddits.includes(val)) { toast.warning("Already in list."); return }
        const updated = [...subreddits, val]
        setSubreddits(updated)
        saveSubreddits(updated)
    }

    const handleRemoveSubreddit = (val: string) => {
        const updated = subreddits.filter(s => s !== val)
        setSubreddits(updated)
        saveSubreddits(updated)
    }

    return (
        <SidebarProvider
            style={{
                "--sidebar-width": "calc(var(--spacing) * 56)",
                "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties}
        >
            <AppSidebar variant="inset" />
            <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col">
                    <div className="@container/main flex flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-6 px-4 py-4 md:py-6 lg:px-6">

                            {/* Header */}
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Control Panel</h1>
                                <p className="text-sm text-muted-foreground">
                                    Configure what the scraper hunts for across all platforms.
                                </p>
                            </div>

                            {/* Keywords — X & LinkedIn */}
                            <Card className="border-border/50">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <IconSearch className="size-4 text-blue-400" />
                                        <CardTitle className="text-base">Search Keywords</CardTitle>
                                        <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            X · LinkedIn
                                        </Badge>
                                    </div>
                                    <CardDescription>
                                        The scraper searches X and LinkedIn for posts matching these keywords.
                                        Use natural language phrases your target clients would actually say.
                                    </CardDescription>
                                </CardHeader>
                                <div className="px-6 pb-6">
                                    <TagManager
                                        items={queries}
                                        onAdd={handleAddQuery}
                                        onRemove={handleRemoveQuery}
                                        placeholder="e.g. 'need a website', 'website redesign'..."
                                        loading={queriesLoading}
                                        saving={queriesSaving}
                                        color="blue"
                                    />
                                </div>
                            </Card>

                            {/* Subreddits — Reddit */}
                            <Card className="border-orange-500/20 bg-orange-500/5">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <IconBrandReddit className="size-4 text-orange-400" />
                                        <CardTitle className="text-base">Target Subreddits</CardTitle>
                                        <Badge className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                            Reddit
                                        </Badge>
                                    </div>
                                    <CardDescription>
                                        Subreddits the Reddit scraper searches through. Add community names without the r/ prefix.
                                        Best subreddits: smallbusiness, entrepreneur, startups, webdesign, Wordpress, ecommerce, marketing.
                                    </CardDescription>
                                </CardHeader>
                                <div className="px-6 pb-6">
                                    <TagManager
                                        items={subreddits}
                                        onAdd={handleAddSubreddit}
                                        onRemove={handleRemoveSubreddit}
                                        placeholder="e.g. smallbusiness, ecommerce, marketing..."
                                        loading={subredditsLoading}
                                        saving={subredditsSaving}
                                        color="orange"
                                    />
                                </div>
                            </Card>

                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
