import useSWR from "swr";

import { fetcher } from "@/lib/utils";

export interface CommentReply {
  id: string;
  content: string;
  viewerEmail: string | null;
  viewerName: string | null;
  isOwn: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  commentNumber?: number;
  content: string;
  pageNumber: number;
  pinX: number;
  pinY: number;
  regionX: number | null;
  regionY: number | null;
  regionWidth: number | null;
  regionHeight: number | null;
  viewerEmail: string | null;
  viewerName: string | null;
  isResolved: boolean;
  isOwn: boolean;
  isAdmin: boolean;
  createdAt: string;
  replies: CommentReply[];
}

export function useViewerComments(linkId: string, viewId?: string) {
  const shouldFetch = linkId && viewId;

  const { data, error, mutate } = useSWR<Comment[]>(
    shouldFetch ? `/api/links/${linkId}/comments?viewId=${viewId}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 15000, // Poll every 15s for new comments from other viewers
    },
  );

  return {
    comments: data,
    loading: !error && !data,
    error,
    mutate,
  };
}

export function useDocumentComments(teamId: string, documentId: string) {
  const { data, error, mutate } = useSWR<any[]>(
    teamId && documentId
      ? `/api/teams/${teamId}/documents/${documentId}/comments`
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 15000, // Poll every 15s for admin to see new viewer comments
    },
  );

  return {
    comments: data,
    loading: !error && !data,
    error,
    mutate,
  };
}
