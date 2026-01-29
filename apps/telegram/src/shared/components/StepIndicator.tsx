interface StepIndicatorProps {
  /** Текущий этап от 1 до 5 */
  currentStep: number;
}

const TOTAL_STEPS = 5;

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const step = Math.max(1, Math.min(TOTAL_STEPS, currentStep));

  return (
    <div className="flex flex-col items-center gap-2 pb-4">
      <span className="text-[#8b5e66] dark:text-pink-300 text-xs font-semibold uppercase tracking-wide">
        Этап {step} из {TOTAL_STEPS}
      </span>
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i + 1 <= step
                ? 'bg-primary dark:bg-primary'
                : 'bg-pink-200 dark:bg-pink-900/40'
            }`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
