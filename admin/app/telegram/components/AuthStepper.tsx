'use client';

import { cn } from '@/lib/utils';
import { Check, Circle, Loader2 } from 'lucide-react';

export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface AuthStep {
  id: string;
  label: string;
  status: StepStatus;
}

interface AuthStepperProps {
  steps: AuthStep[];
  currentStepIndex?: number;
  className?: string;
}

export function AuthStepper({ steps, currentStepIndex, className }: AuthStepperProps) {
  const getStepIndex = (stepId: string) => {
    return steps.findIndex((s) => s.id === stepId);
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between relative">
        {/* Линия прогресса */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border z-0">
          {currentStepIndex !== undefined && currentStepIndex > 0 && (
            <div
              className="h-full bg-primary transition-all duration-300 ease-in-out"
              style={{
                width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
              }}
            />
          )}
        </div>

        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed';
          const isActive = step.status === 'active';
          const isPending = step.status === 'pending';
          const isError = step.status === 'error';
          const isCurrent = currentStepIndex === index;

          return (
            <div
              key={step.id}
              className="relative z-10 flex flex-col items-center flex-1"
            >
              {/* Иконка шага */}
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isActive
                    ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary ring-offset-2'
                    : isError
                    ? 'bg-destructive/10 border-destructive text-destructive'
                    : 'bg-background border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isError ? (
                  <Circle className="w-5 h-5 fill-destructive" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>

              {/* Подпись шага */}
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    'text-xs font-medium transition-colors duration-300',
                    isCompleted || isActive
                      ? 'text-foreground'
                      : isError
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
              </div>

              {/* Соединительная линия (кроме последнего шага) */}
              {index < steps.length - 1 && (
                <div className="absolute top-5 left-[50%] w-[50%] h-0.5 -z-10" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
