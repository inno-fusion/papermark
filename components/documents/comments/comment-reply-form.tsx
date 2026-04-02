"use client";

import { useState } from "react";

import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CommentReplyFormProps {
  onSubmit: (content: string) => void;
}

export default function CommentReplyForm({ onSubmit }: CommentReplyFormProps) {
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setContent("");
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="mt-2 text-xs text-blue-500 hover:text-blue-700"
      >
        Reply...
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Write a reply..."
        className="min-h-[40px] w-full resize-none rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        rows={2}
        autoFocus
      />
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!content.trim()}
        className="self-end"
      >
        <Send className="h-3 w-3" />
      </Button>
    </div>
  );
}
