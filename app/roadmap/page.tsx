'use client';

import { Navbar } from '@/components/ui/navbar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map, Coins, Twitter, Calendar } from 'lucide-react';

export default function RoadmapPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
                <div className="max-w-4xl mx-auto space-y-8">

                    <div className="space-y-2 text-center md:text-left">
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Roadmap</h1>
                        <p className="text-muted-foreground text-lg">
                            The future of the Debate Room protocol.
                        </p>
                    </div>

                    <div className="grid gap-8 relative px-4 border-l-2 border-border ml-4 md:ml-0 md:px-0 md:border-l-0">

                        {/* Phase 1: Current */}
                        <div className="relative md:flex md:gap-8 items-start group">
                            {/* Timeline Dot (Desktop) */}
                            <div className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-full bg-primary items-center justify-center mt-1 z-10 relative">
                                <div className="w-3 h-3 bg-background rounded-full" />
                            </div>
                            {/* Timeline Line (Desktop) */}
                            <div className="hidden md:block absolute left-4 top-9 bottom-[-32px] w-0.5 bg-border -z-10 group-last:hidden" />

                            <Card className="flex-1 border-primary/20 bg-primary/5">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Map className="w-5 h-5 text-primary" />
                                            Classic Debate
                                        </CardTitle>
                                        <Badge>Live Now</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-muted-foreground space-y-2">
                                    <p>
                                        The core of Debate Room. Users can create specialized debate rooms,
                                        configure rules, and invite participants.
                                    </p>
                                    <ul className="list-disc pl-5 text-sm space-y-1">
                                        <li>Smart Contract deployment per debate</li>
                                        <li>AI Jury evaluation (Logic, Evidence, etc.)</li>
                                        <li>Transparent Leaderboard</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Phase 2: Q1-Q2 */}
                        <div className="relative md:flex md:gap-8 items-start group">
                            <div className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-full bg-muted border-2 border-primary/50 items-center justify-center mt-1 z-10 relative">
                                <div className="w-2 h-2 bg-primary/50 rounded-full" />
                            </div>
                            <div className="hidden md:block absolute left-4 top-9 bottom-[-32px] w-0.5 bg-border -z-10" />

                            <Card className="flex-1">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Coins className="w-5 h-5 text-blue-500" />
                                            Rewards System
                                        </CardTitle>
                                        <Badge variant="outline">Q1 - Q2 2026</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-muted-foreground space-y-2">
                                    <p>
                                        Incentivizing high-quality discourse. Debate creators can deposit USDC rewards
                                        into the smart contract pool.
                                    </p>
                                    <ul className="list-disc pl-5 text-sm space-y-1">
                                        <li>USDC Prize Pools</li>
                                        <li>Proportional Distribution based on AI Score</li>
                                        <li>Automatic Payouts upon resolution</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Phase 3: Q2 */}
                        <div className="relative md:flex md:gap-8 items-start group">
                            <div className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-full bg-muted border-2 border-primary/50 items-center justify-center mt-1 z-10 relative">
                                <div className="w-2 h-2 bg-primary/50 rounded-full" />
                            </div>
                            <div className="hidden md:block absolute left-4 top-9 bottom-[-32px] w-0.5 bg-border -z-10" />

                            <Card className="flex-1">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Twitter className="w-5 h-5 text-sky-500" />
                                            Modern Debate
                                        </CardTitle>
                                        <Badge variant="outline">Q2 2026</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-muted-foreground space-y-2">
                                    <p>
                                        Bringing Crypto Twitter (CT) chaos into a structured environment.
                                    </p>
                                    <ul className="list-disc pl-5 text-sm space-y-1">
                                        <li>Import arguments directly from X/Twitter threads</li>
                                        <li>Influencer vs Community debates</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Phase 4: Future */}
                        <div className="relative md:flex md:gap-8 items-start group">
                            <div className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-full bg-muted items-center justify-center mt-1 z-10">
                                <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                            </div>

                            <Card className="flex-1 opacity-80">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Calendar className="w-5 h-5" />
                                            Future Expansion
                                        </CardTitle>
                                        <Badge variant="secondary">Q3 - Q4</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-muted-foreground">
                                    <p className="italic">
                                        To Be Announced (TBA) — Focusing on scalability.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
