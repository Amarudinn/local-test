import Image from 'next/image';
import { generateGradient } from '@/lib/pinata';
import { cn } from '@/lib/utils';

interface DebateCoverProps {
    topic: string;
    imageUrl?: string | null;
    className?: string;
    priority?: boolean;
}

export function DebateCover({ topic, imageUrl, className, priority = false }: DebateCoverProps) {
    if (imageUrl) {
        return (
            <div className={cn("relative overflow-hidden bg-muted", className)}>
                <Image
                    src={imageUrl}
                    alt={topic}
                    fill
                    className="object-cover transition-transform hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority={priority}
                />
            </div>
        );
    }

    return (
        <div
            className={cn("w-full h-full", className)}
            style={{ background: generateGradient(topic) }}
            aria-label={`Cover for ${topic}`}
        />
    );
}
