import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900">
              <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <CardTitle className="text-2xl">Page Not Found</CardTitle>
              <CardDescription>Error 404</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button asChild className="flex-1">
              <Link href="/" className="gap-2">
                <Home className="h-4 w-4" />
                Go Home
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/debates" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Browse Debates
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
