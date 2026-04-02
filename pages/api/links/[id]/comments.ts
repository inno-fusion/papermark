import { NextApiRequest, NextApiResponse } from "next";

import { z } from "zod";

import { errorhandler } from "@/lib/errorHandler";
import prisma from "@/lib/prisma";
import { log } from "@/lib/utils";

const createCommentSchema = z.object({
  viewId: z.string().min(1),
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be less than 2000 characters"),
  pageNumber: z.number().int().min(1),
  pinX: z.number().min(0).max(100),
  pinY: z.number().min(0).max(100),
  regionX: z.number().min(0).max(100).optional(),
  regionY: z.number().min(0).max(100).optional(),
  regionWidth: z.number().min(0).max(100).optional(),
  regionHeight: z.number().min(0).max(100).optional(),
  parentId: z.string().optional(),
});

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id: linkId } = req.query as { id: string };

  if (req.method === "GET") {
    const { viewId } = req.query as { viewId: string };

    if (!viewId) {
      return res.status(400).json({ error: "viewId is required" });
    }

    try {
      const view = await prisma.view.findUnique({
        where: { id: viewId, linkId },
        include: {
          link: {
            select: {
              enableComments: true,
              emailProtected: true,
              deletedAt: true,
              linkType: true,
              documentId: true,
              teamId: true,
            },
          },
        },
      });

      if (!view) {
        return res.status(404).json({ error: "View not found" });
      }

      if (view.link.deletedAt) {
        return res.status(404).json({ error: "Link deleted" });
      }

      if (view.viewedAt < new Date(Date.now() - 1000 * 60 * 60 * 23)) {
        return res.status(404).json({ error: "View expired" });
      }

      if (!view.link.enableComments || !view.link.emailProtected) {
        return res.status(200).json([]);
      }

      if (!view.viewerId) {
        return res.status(200).json([]);
      }

      if (view.link.linkType !== "DOCUMENT_LINK" || !view.link.documentId) {
        return res.status(200).json([]);
      }

      const comments = await prisma.documentComment.findMany({
        where: {
          documentId: view.link.documentId,
          linkId,
          parentId: null, // Only top-level comments
        },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const sanitizedComments = comments.map((comment, index) => ({
        id: comment.id,
        commentNumber: index + 1,
        content: comment.content,
        pageNumber: comment.pageNumber,
        pinX: comment.pinX,
        pinY: comment.pinY,
        regionX: comment.regionX,
        regionY: comment.regionY,
        regionWidth: comment.regionWidth,
        regionHeight: comment.regionHeight,
        viewerEmail: comment.viewerEmail,
        viewerName: comment.viewerName,
        isResolved: comment.isResolved,
        isOwn: comment.viewerId === view.viewerId,
        isAdmin: !!comment.userId,
        createdAt: comment.createdAt,
        replies: comment.replies.map((reply) => ({
          id: reply.id,
          content: reply.content,
          viewerEmail: reply.viewerEmail,
          viewerName: reply.viewerName,
          isOwn: reply.viewerId === view.viewerId,
          isAdmin: !!reply.userId,
          createdAt: reply.createdAt,
        })),
      }));

      return res.status(200).json(sanitizedComments);
    } catch (error) {
      log({
        message: `Failed to get comments for link: _${linkId}_. \n\n ${error}`,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else if (req.method === "POST") {
    try {
      const validatedData = createCommentSchema.parse(req.body);

      const view = await prisma.view.findUnique({
        where: { id: validatedData.viewId, linkId },
        include: {
          link: {
            select: {
              enableComments: true,
              emailProtected: true,
              deletedAt: true,
              linkType: true,
              documentId: true,
              teamId: true,
            },
          },
        },
      });

      if (!view) {
        return res.status(404).json({ error: "View not found" });
      }

      if (view.link.deletedAt) {
        return res.status(404).json({ error: "Link deleted" });
      }

      if (view.viewedAt < new Date(Date.now() - 1000 * 60 * 60 * 23)) {
        return res.status(403).json({ error: "View expired" });
      }

      if (!view.link.enableComments || !view.link.emailProtected) {
        return res.status(403).json({ error: "Comments not enabled" });
      }

      if (!view.viewerId) {
        return res
          .status(403)
          .json({ error: "Only verified viewers can comment" });
      }

      if (view.link.linkType !== "DOCUMENT_LINK" || !view.link.documentId) {
        return res
          .status(400)
          .json({ error: "Comments only supported on document links" });
      }

      // Validate parent comment exists on same document+link if replying
      if (validatedData.parentId) {
        const parentComment = await prisma.documentComment.findFirst({
          where: {
            id: validatedData.parentId,
            documentId: view.link.documentId,
            linkId,
            parentId: null, // Can only reply to top-level comments
          },
        });

        if (!parentComment) {
          return res.status(404).json({ error: "Parent comment not found" });
        }
      }

      const comment = await prisma.documentComment.create({
        data: {
          content: validatedData.content,
          pageNumber: validatedData.pageNumber,
          pinX: validatedData.pinX,
          pinY: validatedData.pinY,
          regionX: validatedData.regionX,
          regionY: validatedData.regionY,
          regionWidth: validatedData.regionWidth,
          regionHeight: validatedData.regionHeight,
          documentId: view.link.documentId,
          linkId,
          viewId: validatedData.viewId,
          viewerId: view.viewerId,
          viewerEmail: view.viewerEmail,
          viewerName: view.viewerName,
          teamId: view.link.teamId!,
          parentId: validatedData.parentId,
        },
      });

      return res.status(201).json({
        id: comment.id,
        content: comment.content,
        pageNumber: comment.pageNumber,
        pinX: comment.pinX,
        pinY: comment.pinY,
        regionX: comment.regionX,
        regionY: comment.regionY,
        regionWidth: comment.regionWidth,
        regionHeight: comment.regionHeight,
        viewerEmail: comment.viewerEmail,
        viewerName: comment.viewerName,
        isResolved: comment.isResolved,
        isOwn: true,
        isAdmin: false,
        createdAt: comment.createdAt,
        replies: [],
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid input",
          details: error.errors,
        });
      }

      log({
        message: `Failed to create comment for link: _${linkId}_. \n\n ${error}`,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else if (req.method === "DELETE") {
    const { viewId, commentId } = req.query as {
      viewId: string;
      commentId: string;
    };

    if (!viewId || !commentId) {
      return res
        .status(400)
        .json({ error: "viewId and commentId are required" });
    }

    try {
      const view = await prisma.view.findUnique({
        where: { id: viewId, linkId },
      });

      if (!view) {
        return res.status(404).json({ error: "View not found" });
      }

      if (!view.viewerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const comment = await prisma.documentComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (comment.viewerId !== view.viewerId) {
        return res.status(403).json({ error: "Can only delete own comments" });
      }

      await prisma.documentComment.delete({
        where: { id: commentId },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      log({
        message: `Failed to delete comment for link: _${linkId}_. \n\n ${error}`,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
