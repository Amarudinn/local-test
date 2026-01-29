'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DebateDetail } from '@/components/debates/DebateDetail';
import { Navbar } from '@/components/ui/navbar';
import { isValidAddress } from '@/lib/address-validator';
import { ArrowLeft, AlertCircle } from 'lucide-react';

interface DebateDetailPageProps {
  params: Promise<{
    contractAddress: string;
  }>;
}

export default function DebateDetailPage({ params }: DebateDetailPageProps) {
  const router = useRouter();
  const { contractAddress } = use(params);

  // Validate contract address format
  const isValid = isValidAddress(contractAddress);

  // Show 404 page for invalid addresses
  if (!isValid) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/debates')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Debates
          </Button>
        </div>

        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-2xl">Debate Not Found</CardTitle>
                <CardDescription>Invalid contract address</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The contract address you provided is not valid. Please check the URL and try again.
            </p>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {contractAddress}
              </p>
            </div>
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-3">
                Valid address formats:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Ethereum: 0x followed by 40 hexadecimal characters</li>
                <li>GenLayer: 0x followed by 64 hexadecimal characters</li>
              </ul>
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={() => router.push('/debates')} className="flex-1">
                Browse Debates
              </Button>
              <Button onClick={() => router.push('/')} variant="outline" className="flex-1">
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Back button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/debates')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Debates
        </Button>
      </div>

      {/* Debate Detail Component */}
      <DebateDetail contractAddress={contractAddress} />
    </div>
    </>
  );
}
