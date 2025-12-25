import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface CategoryScore {
  category: string;
  score: number;
  keywords: string[];
}

interface CategoryConfidenceChartProps {
  scores: CategoryScore[];
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  crypto: 'bg-amber-500',
  pwn: 'bg-red-500',
  rev: 'bg-purple-500',
  forensics: 'bg-blue-500',
  web: 'bg-green-500',
  misc: 'bg-gray-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto',
  pwn: 'Pwn',
  rev: 'Reverse',
  forensics: 'Forensics',
  web: 'Web',
  misc: 'Misc',
};

export function CategoryConfidenceChart({ 
  scores, 
  selectedCategory,
  onSelectCategory 
}: CategoryConfidenceChartProps) {
  const { normalizedScores, maxScore } = useMemo(() => {
    const max = Math.max(...scores.map(s => s.score), 1);
    return {
      normalizedScores: scores.map(s => ({
        ...s,
        percentage: (s.score / max) * 100
      })),
      maxScore: max
    };
  }, [scores]);

  if (scores.length === 0 || maxScore === 0) {
    return null;
  }

  return (
    <div className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-border">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Category Confidence Scores
      </div>
      <div className="space-y-1.5">
        {normalizedScores.map(({ category, score, percentage, keywords }) => (
          <button
            key={category}
            type="button"
            onClick={() => onSelectCategory?.(category)}
            className={cn(
              "w-full group flex items-center gap-2 p-1.5 rounded transition-all",
              "hover:bg-secondary/50",
              selectedCategory === category && "bg-secondary ring-1 ring-primary/50"
            )}
          >
            <div className="w-16 text-xs font-medium text-left truncate">
              {CATEGORY_LABELS[category] || category}
            </div>
            <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden relative">
              <div
                className={cn(
                  "h-full transition-all duration-500 ease-out rounded-full",
                  CATEGORY_COLORS[category] || 'bg-primary',
                  selectedCategory === category ? 'opacity-100' : 'opacity-70 group-hover:opacity-90'
                )}
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
              {score > 0 && (
                <div className="absolute inset-0 flex items-center px-2">
                  <span className={cn(
                    "text-[10px] font-mono",
                    percentage > 40 ? "text-white" : "text-foreground"
                  )}>
                    {score.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <div className="w-10 text-right text-[10px] text-muted-foreground font-mono">
              {percentage > 0 ? `${Math.round(percentage)}%` : '-'}
            </div>
          </button>
        ))}
      </div>
      {selectedCategory && (
        <div className="pt-2 border-t border-border mt-2">
          <div className="text-[10px] text-muted-foreground">
            Keywords: {normalizedScores.find(s => s.category === selectedCategory)?.keywords.slice(0, 6).join(', ') || 'none'}
          </div>
        </div>
      )}
    </div>
  );
}
