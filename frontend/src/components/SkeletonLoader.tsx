interface SkeletonLoaderProps {
  className?: string;
  count?: number;
  height?: string;
  width?: string;
  rounded?: boolean;
}

export default function SkeletonLoader({
  className = '',
  count = 1,
  height = '1rem',
  width = '100%',
  rounded = false,
}: SkeletonLoaderProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse bg-muted ${rounded ? 'rounded-full' : 'rounded'} ${className}`}
          style={{ height, width }}
        />
      ))}
    </>
  );
}

// Специализированные скелетоны для разных компонентов
export function ServiceCardSkeleton() {
  return (
    <div className="bg-card rounded-lg shadow-md p-4 sm:p-6 animate-pulse border border-border">
      <div className="h-5 sm:h-6 bg-muted rounded w-3/4 mb-3 sm:mb-4"></div>
      <div className="h-3 sm:h-4 bg-muted rounded w-full mb-2"></div>
      <div className="h-3 sm:h-4 bg-muted rounded w-5/6 mb-3 sm:mb-4"></div>
      <div className="flex justify-between items-center">
        <div className="h-7 sm:h-8 bg-muted rounded w-20 sm:w-24"></div>
        <div className="h-7 sm:h-8 bg-muted rounded w-16 sm:w-20"></div>
      </div>
    </div>
  );
}

export function AppointmentCardSkeleton() {
  return (
    <div className="bg-card rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4 animate-pulse border border-border">
      <div className="flex justify-between items-start mb-2 sm:mb-3">
        <div className="h-4 sm:h-5 bg-muted rounded w-1/2"></div>
        <div className="h-5 sm:h-6 bg-muted rounded w-16 sm:w-20"></div>
      </div>
      <div className="h-3 sm:h-4 bg-muted rounded w-3/4 mb-2"></div>
      <div className="h-3 sm:h-4 bg-muted rounded w-1/2"></div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6 animate-pulse border border-border">
          <div className="h-7 sm:h-8 bg-muted rounded w-1/3 mb-3 sm:mb-4"></div>
          <div className="h-3 sm:h-4 bg-muted rounded w-full mb-2"></div>
          <div className="h-3 sm:h-4 bg-muted rounded w-5/6"></div>
        </div>
        <div className="bg-card rounded-lg shadow-md p-4 sm:p-6 animate-pulse border border-border">
          <div className="h-5 sm:h-6 bg-muted rounded w-1/4 mb-3 sm:mb-4"></div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-3 sm:mb-4">
              <div className="h-16 sm:h-20 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

