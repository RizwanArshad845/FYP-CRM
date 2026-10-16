import { Star } from 'lucide-react';

interface StarRatingProps {
    rating: number;
    max?: number;
}

export function StarRating({ rating, max = 5 }: StarRatingProps) {
    if (rating === 0) return <span className="text-sm text-muted-foreground">Not rated</span>;
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: max }, (_, i) => (
                <Star
                    key={i}
                    className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                />
            ))}
        </div>
    );
}
