"use client"

import * as React from "react"
import { IconPlus, IconX, IconLoader2 } from "@tabler/icons-react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { toast } from "sonner"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"


export default function SettingsPage() {
    const [queries, setQueries] = React.useState<string[]>([])
    const [loading, setLoading] = React.useState(true)
    const [newKeyword, setNewKeyword] = React.useState("")
    const [isSaving, setIsSaving] = React.useState(false)

    const fetchQueries = React.useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/queries`)
            const data = await res.json()
            if (data.success) {
                setQueries(data.queries || [])
            }
        } catch (err) {
            console.error("Failed to fetch queries:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        fetchQueries()
    }, [fetchQueries])

    async function handleAddKeyword() {
        if (!newKeyword.trim()) return
        const updated = [...queries, newKeyword.trim()]
        setQueries(updated)
        setNewKeyword("")
        await saveQueries(updated)
    }

    async function handleRemoveKeyword(keywordToRemove: string) {
        const updated = queries.filter((k) => k !== keywordToRemove)
        setQueries(updated)
        await saveQueries(updated)
    }

    async function saveQueries(updatedQueries: string[]) {
        setIsSaving(true)
        try {
            const res = await fetch(`${API_URL}/api/queries`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ queries: updatedQueries }),
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Settings saved. Scraper is now synced.")
            }
        } catch (err) {
            toast.error("Failed to save settings")
        } finally {
            setIsSaving(false)
        }
    }


    return (
        <SidebarProvider
            style={
                {
                    "--sidebar-width": "calc(var(--spacing) * 56)",
                    "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
            }
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
                                    Manage the keywords your Python scraper uses to hunt for leads on X.
                                </p>
                            </div>

                            {/* Add Keyword */}
                            <Card className="border-border/50">
                                <CardHeader>
                                    <CardTitle className="text-base">Active Keywords</CardTitle>
                                    <CardDescription>
                                        When your scraper runs, it searches X for posts matching these keywords.
                                        Add or remove keywords to tune what kind of leads you capture.
                                    </CardDescription>
                                </CardHeader>
                                <div className="px-6 pb-6">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g. 'need a backend dev', 'building saas'"
                                            value={newKeyword}
                                            onChange={(e) => setNewKeyword(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                                            className="flex-1"
                                        />
                                        <Button onClick={handleAddKeyword} disabled={isSaving || !newKeyword.trim()}>
                                            {isSaving ? (
                                                <IconLoader2 className="mr-1 size-4 animate-spin" />
                                            ) : (
                                                <IconPlus className="mr-1 size-4" />
                                            )}
                                            Add
                                        </Button>
                                    </div>

                                    {/* Keywords Tags */}
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {loading ? (
                                            <p className="text-sm text-muted-foreground">Loading...</p>
                                        ) : queries.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                No keywords configured. Add one above to start hunting.
                                            </p>
                                        ) : (
                                            queries.map((keyword, idx) => (
                                                <Badge
                                                    key={idx}
                                                    variant="outline"
                                                    className="gap-1 bg-primary/5 py-1.5 pl-3 pr-1.5 text-sm"
                                                >
                                                    {keyword}
                                                    <button
                                                        onClick={() => handleRemoveKeyword(keyword)}
                                                        className="ml-1 rounded-full p-0.5 transition-colors hover:bg-destructive/20 hover:text-destructive"
                                                    >
                                                        <IconX className="size-3" />
                                                    </button>
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
