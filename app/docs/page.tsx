'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/ui/navbar';
import { Badge } from '@/components/ui/badge';
import { Code, GitBranch, Shield, Zap, BookOpen, Layers, Terminal, CheckCircle2 } from 'lucide-react';

export default function DocsPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
                <div className="max-w-4xl mx-auto space-y-8">

                    <div className="space-y-2">
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Documentation</h1>
                        <p className="text-muted-foreground text-lg">
                            Technical guide and architectural overview of the Debate Room protocol.
                        </p>
                    </div>

                    <Tabs defaultValue="overview" className="space-y-8">
                        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="technical">Technical</TabsTrigger>
                        </TabsList>

                        {/* OVERVIEW TAB */}
                        <TabsContent value="overview" className="space-y-8">
                            {/* Introduction */}
                            <section className="space-y-4">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <BookOpen className="w-6 h-6 text-primary" />
                                    What is Debate Room?
                                </h2>
                                <p className="leading-relaxed text-muted-foreground">
                                    Debate Room is a decentralized platform where users can engage in structured debates,
                                    judged objectively by an AI Jury powered by GenLayer. Unlike traditional platforms where
                                    winners are determined by popularity or likes, our system evaluates the <strong>quality</strong> of arguments based on logic, evidence, and clarity.
                                </p>
                            </section>

                            {/* How It Works */}
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold">How It Works</h2>

                                <div className="grid gap-6 md:grid-cols-3">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Badge variant="outline">1</Badge>
                                                Create Debate
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm text-muted-foreground">
                                            Deploy a new smart contract instance for your topic. Define duration, max participants, and customize evaluation criteria weights (e.g., prioritize Logic over Persuasiveness).
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Badge variant="outline">2</Badge>
                                                Submit Argument
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm text-muted-foreground">
                                            Connect your wallet and submit your argument to the blockchain. Each submission is verified and timestamped. Arguments are immutable once submitted.
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Badge variant="outline">3</Badge>
                                                AI Evaluation
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm text-muted-foreground">
                                            Our Intelligent Contract (GenLayer) reads your argument and evaluates it against the defined criteria using Large Language Models (LLMs) running directly in the consensus layer.
                                        </CardContent>
                                    </Card>
                                </div>
                            </section>

                            {/* Lifecycle Status */}
                            <section className="space-y-4">
                                <h2 className="text-2xl font-bold">Debate Lifecycle</h2>
                                <div className="space-y-4">
                                    <div className="flex gap-4 items-start border p-4 rounded-lg">
                                        <Badge className="bg-green-500 hover:bg-green-600 mt-1">OPEN</Badge>
                                        <div>
                                            <h3 className="font-semibold">Waiting for Arguments</h3>
                                            <p className="text-sm text-muted-foreground">New debate created. Users can join. Time has not started yet.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-start border p-4 rounded-lg">
                                        <Badge className="bg-blue-500 hover:bg-blue-600 mt-1">ONGOING</Badge>
                                        <div>
                                            <h3 className="font-semibold">Active Debate</h3>
                                            <p className="text-sm text-muted-foreground">Arguments are being accepted. Timer is running. Ends when time expires or max participants reached.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-start border p-4 rounded-lg">
                                        <Badge variant="secondary" className="mt-1">ENDED</Badge>
                                        <div>
                                            <h3 className="font-semibold">Submission Closed</h3>
                                            <p className="text-sm text-muted-foreground">No more arguments accepted. Waiting for final resolution.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-start border p-4 rounded-lg">
                                        <Badge variant="outline" className="border-green-500 text-green-500 mt-1">RESOLVED</Badge>
                                        <div>
                                            <h3 className="font-semibold">Finalized</h3>
                                            <p className="text-sm text-muted-foreground">Winner declared. Leaderboard and detailed scores are public.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </TabsContent>

                        {/* TECHNICAL TAB */}
                        <TabsContent value="technical" className="space-y-8">

                            {/* Architecture Overview */}
                            <section className="space-y-4">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Layers className="w-6 h-6 text-primary" />
                                    Architecture
                                </h2>
                                <Card>
                                    <CardContent className="pt-6 space-y-4">
                                        <p className="text-muted-foreground">
                                            Debate Room utilizes a <strong>Hybrid Architecture</strong> to ensure both decentralized integrity and high-performance user experience.
                                        </p>
                                        <ul className="list-disc pl-5 space-y-2 text-sm md:text-base">
                                            <li><strong>Frontend:</strong> Next.js 14 (App Router) for responsive UI.</li>
                                            <li><strong>Blockchain:</strong> GenLayer (Intelligent Contracts) for logic and AI execution.</li>
                                            <li><strong>Database:</strong> Supabase (PostgreSQL) for caching and fast data retrieval.</li>
                                            <li><strong>Sync Service:</strong> Automatic bi-directional syncing between Blockchain and Database.</li>
                                        </ul>
                                    </CardContent>
                                </Card>
                            </section>

                            {/* Smart Contracts */}
                            <section className="space-y-4">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Code className="w-6 h-6 text-primary" />
                                    Smart Contract
                                </h2>
                                <p className="text-muted-foreground mb-4">
                                    The core logic resides in <code className="bg-muted px-1.5 py-0.5 rounded text-sm">contracts/debate_room.py</code>.
                                </p>

                                <div className="grid gap-6 md:grid-cols-2">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Terminal className="w-4 h-4" /> State Management
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm text-muted-foreground space-y-2">
                                            <p>Stores debate metadata, participants, and arguments legally on-chain.</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                <li><code>participants</code>: TreeMap of user addresses.</li>
                                                <li><code>arguments</code>: DynArray of argument submissions.</li>
                                                <li><code>all_scores</code>: Final results after AI evaluation.</li>
                                            </ul>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <GitBranch className="w-4 h-4" /> Workflow Functions
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm text-muted-foreground space-y-2">
                                            <p>Key endpoints exposed by the contract:</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                <li><code>join_debate()</code>: Validates rules & adds argument.</li>
                                                <li><code>evaluate_single_argument()</code>: Triggers AI analysis.</li>
                                                <li><code>finalize_results()</code>: Aggregates scores & declares winner.</li>
                                            </ul>
                                        </CardContent>
                                    </Card>
                                </div>
                            </section>

                            {/* AI Jury */}
                            <section className="space-y-4">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Zap className="w-6 h-6 text-primary" />
                                    AI Jury (GenLayer)
                                </h2>
                                <p className="text-muted-foreground">
                                    Powered by GenLayer's <code>gl.nondet.exec_prompt</code>, allowing smart contracts to essentially "read" and "understand" natural language arguments.
                                </p>

                                <div className="bg-muted/50 p-4 rounded-lg border space-y-3">
                                    <h3 className="font-semibold">Evaluation Logic</h3>
                                    <p className="text-sm text-muted-foreground">
                                        The contract constructs a prompt for the LLM with the Debate Topic, Description, and the Argument.
                                        It demands a JSON response with scores across 6 weighted criteria:
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                                        <div className="bg-background p-2 rounded border">Logic & Reasoning (25%)</div>
                                        <div className="bg-background p-2 rounded border">Evidence & Facts (20%)</div>
                                        <div className="bg-background p-2 rounded border">Clarity (15%)</div>
                                        <div className="bg-background p-2 rounded border">Relevance (15%)</div>
                                        <div className="bg-background p-2 rounded border">Originality (15%)</div>
                                        <div className="bg-background p-2 rounded border">Persuasiveness (10%)</div>
                                    </div>
                                </div>
                            </section>

                            {/* Security */}
                            <section className="space-y-4">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Shield className="w-6 h-6 text-primary" />
                                    Security Considerations
                                </h2>
                                <ul className="grid gap-3 md:grid-cols-2">
                                    <li className="flex gap-3 items-start border p-3 rounded-lg bg-background">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                                        <div>
                                            <div className="font-semibold text-sm">Decentralized Execution</div>
                                            <div className="text-xs text-muted-foreground">Code runs on multiple validators, not a single central server.</div>
                                        </div>
                                    </li>
                                    <li className="flex gap-3 items-start border p-3 rounded-lg bg-background">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                                        <div>
                                            <div className="font-semibold text-sm">Consensus Mechanism</div>
                                            <div className="text-xs text-muted-foreground">Validators must agree on AI scores (within a tolerance range) to prevent hallucinations.</div>
                                        </div>
                                    </li>
                                    <li className="flex gap-3 items-start border p-3 rounded-lg bg-background">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                                        <div>
                                            <div className="font-semibold text-sm">Immutable Records</div>
                                            <div className="text-xs text-muted-foreground">Once resolved, the winner and scores are permanently recorded on the blockchain.</div>
                                        </div>
                                    </li>
                                    <li className="flex gap-3 items-start border p-3 rounded-lg bg-background">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                                        <div>
                                            <div className="font-semibold text-sm">Privy Authentication</div>
                                            <div className="text-xs text-muted-foreground">Secure non-custodial login ensuring user identity without exposing private keys.</div>
                                        </div>
                                    </li>
                                </ul>
                            </section>

                        </TabsContent>
                    </Tabs>

                </div>
            </main>
        </div>
    );
}
