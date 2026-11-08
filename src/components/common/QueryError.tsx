import { AlertTriangle } from "lucide-react";
import { Button } from "./Button.js";
import { Card } from "./Card.js";

type QueryErrorProps = {
  message?: string;
  onRetry: () => void;
};

export function QueryError({ message = "Could not load this information.", onRetry }: QueryErrorProps) {
  return (
    <Card className="border-rose-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
        <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    </Card>
  );
}
