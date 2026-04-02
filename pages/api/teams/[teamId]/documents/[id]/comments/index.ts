import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { errorhandler } from "@/lib/errorHandler";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { log } from "@/lib/utils";

const replySchema = z.object({
  content: z
    .string()
    .min(1, "Reply cannot be empty")
    .max(2000, "Reply must be less than 2000 characters"),
  parentId: z.string().min(1, "parentId is required"),
});

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).end("Unauthorized");
  }

  const { teamId, id: docId } = req.query as { teamId: string; id: string };
  const userId = (session.user as CustomUser).id;

  // Validate team access
  const teamAccess = await prisma.userTeam.findUnique({
    where: {
      userId_teamId: { userId, teamId },
    },
  });

  if (!teamAccess) {
    return res.status(401).end("Unauthorized");
  }

  if (req.method === "GET") {
    try {
      const document = await prisma.document.findUnique({
        where: { id: docId, teamId },
        select: { id: true },
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      const comments = await prisma.documentComment.findMany({
        where: {
          documentId: docId,
          teamId,
          parentId: null, // Only top-level comments
        },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          link: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(comments);
    } catch (error) {
      log({
        message: `Failed to get comments for document: _${docId}_. \n\n ${error} \n\n*Metadata*: \`{teamId: ${teamId}, userId: ${userId}}\``,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else if (req.method === "POST") {
    try {
      const validatedData = replySchema.parse(req.body);

      const document = await prisma.document.findUnique({
        where: { id: docId, teamId },
        select: { id: true },
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Validate parent comment exists
      const parentComment = await prisma.documentComment.findFirst({
        where: {
          id: validatedData.parentId,
          documentId: docId,
          teamId,
          parentId: null, // Can only reply to top-level comments
        },
      });

      if (!parentComment) {
        return res.status(404).json({ error: "Parent comment not found" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      const reply = await prisma.documentComment.create({
        data: {
          content: validatedData.content,
          pageNumber: parentComment.pageNumber,
          pinX: parentComment.pinX,
          pinY: parentComment.pinY,
          documentId: docId,
          linkId: parentComment.linkId,
          viewId: parentComment.viewId, // Use parent's viewId for consistency
          teamId,
          userId,
          viewerEmail: user?.email,
          viewerName: user?.name,
          parentId: validatedData.parentId,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return res.status(201).json(reply);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid input",
          details: error.errors,
        });
      }

      log({
        message: `Failed to create comment reply for document: _${docId}_. \n\n ${error} \n\n*Metadata*: \`{teamId: ${teamId}, userId: ${userId}}\``,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
