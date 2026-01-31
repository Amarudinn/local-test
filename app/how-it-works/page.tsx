'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, MessageSquare, Gavel, Trophy, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/ui/navbar';

export default function HowItWorksPage() {
    const steps = [
        {
            id: 1,
            title: 'Connect Your Wallet',
            description: 'Sign in securely using Privy. Validates your identity to ensure fair play, but keeps your email private.',
            icon: Wallet,
            color: 'text-blue-500',
            bgColor: 'bg-blue-50 dark:bg-blue-950',
        },
        {
            id: 2,
            title: 'Create or Join a Debate',
            description: 'Browse active debates to join, or create your own topic. Set duration, max participants, and specific evaluation criteria.',
            icon: MessageSquare,
            color: 'text-purple-500',
            bgColor: 'bg-purple-50 dark:bg-purple-950',
        },
        {
            id: 3,
            title: 'Submit Your Argument',
            description: 'Craft your best argument. Our AI Judge (powered by GenLayer) evaluates it based on logic, evidence, clarity, and more.',
            icon: Gavel,
            color: 'text-orange-500',
            bgColor: 'bg-orange-50 dark:bg-orange-950',
        },
        {
            id: 4,
            title: 'Win & Leaderboard',
            description: 'The highest quality argument wins! Access detailed performance insights and climb the leaderboard.',
            icon: Trophy,
            color: 'text-yellow-500',
            bgColor: 'bg-yellow-50 dark:bg-yellow-950',
        },
    ];

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 py-12 md:py-20">
                <div className="max-w-3xl mx-auto space-y-12">

                    {/* Header */}
                    <div className="text-center space-y-4">
                        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
                            How <span className="text-primary">Debate Room</span> Works
                        </h1>
                        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
                            A decentralized platform where arguments are judged by AI, not popularity.
                            Fair, transparent, and built on GenLayer.
                        </p>
                    </div>

                    {/* Steps */}
                    <div className="grid gap-6 md:gap-8">
                        {steps.map((step) => {
                            return (
                                <div key={step.id} className="relative">
                                    {/* Content Card */}
                                    <Card className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                    Step {step.id}
                                                </span>
                                                <h3 className="text-xl font-bold">{step.title}</h3>
                                            </div>
                                            <p className="text-muted-foreground leading-relaxed">
                                                {step.description}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>

                    {/* CTA */}
                    <div className="text-center pt-8">
                        <Link href="/debates">
                            <Button size="lg" className="h-12 px-8 text-lg gap-2">
                                Start Debating Now
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
