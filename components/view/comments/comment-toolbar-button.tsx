import { MessageSquarePlus, MessageSquareDashed } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CommentToolbarButtonProps {
  active: boolean;
  onToggle: (active: boolean) => void;
}

export default function CommentToolbarButton({
  active,
  onToggle,
}: CommentToolbarButtonProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => onToggle(!active)}
            className={
              active
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-900 text-white hover:bg-gray-900/80"
            }
            size="icon"
          >
            {active ? (
              <MessageSquareDashed className="h-5 w-5" />
            ) : (
              <MessageSquarePlus className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{active ? "Exit comment mode" : "Add comment"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
