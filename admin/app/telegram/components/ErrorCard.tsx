'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorCardProps {
  title: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export function ErrorCard({ title, message, actionText = 'Повторить', onAction }: ErrorCardProps) {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <CardTitle className="text-destructive">{title}</CardTitle>
        </div>
        {message && (
          <CardDescription>{message}</CardDescription>
        )}
      </CardHeader>
      {onAction && (
        <CardContent>
          <Button onClick={onAction} variant="outline" className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            {actionText}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

