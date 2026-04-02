import { useRef, useState } from "react";

import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CommentInputProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onFocusChange?: (focused: boolean) => void;
}

export default function CommentInput({
  onSubmit,
  placeholder = "Write a comment...",
  autoFocus = false,
  disabled = false,
  onFocusChange,
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className="min-h-[60px] w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        rows={2}
      />
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!content.trim() || disabled}
        className="self-end"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
