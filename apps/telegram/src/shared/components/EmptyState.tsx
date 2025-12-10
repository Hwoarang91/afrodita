interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-3 sm:px-4">
      <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">{icon}</div>
      <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 text-center">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 text-center max-w-md">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-primary text-primary-foreground px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm sm:text-base"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

