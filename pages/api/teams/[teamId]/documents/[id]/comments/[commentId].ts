import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { errorhandler } from "@/lib/errorHandler";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { log } from "@/lib/utils";

const updateCommentSchema = z.object({
  isResolved: z.boolean(),
});

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).end("Unauthorized");
  }

  const {
    teamId,
    id: docId,
    commentId,
  } = req.query as {
    teamId: string;
    id: string;
    commentId: string;
  };
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

  if (req.method === "PATCH") {
    try {
      const validatedData = updateCommentSchema.parse(req.body);

      const comment = await prisma.documentComment.findFirst({
        where: { id: commentId, documentId: docId, teamId },
      });

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const updatedComment = await prisma.documentComment.update({
        where: { id: commentId },
        data: { isResolved: validatedData.isResolved },
      });

      return res.status(200).json(updatedComment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid input",
          details: error.errors,
        });
      }

      log({
        message: `Failed to update comment: _${commentId}_. \n\n ${error} \n\n*Metadata*: \`{teamId: ${teamId}, userId: ${userId}}\``,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else if (req.method === "DELETE") {
    try {
      const comment = await prisma.documentComment.findFirst({
        where: { id: commentId, documentId: docId, teamId },
      });

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      await prisma.documentComment.delete({
        where: { id: commentId },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      log({
        message: `Failed to delete comment: _${commentId}_. \n\n ${error} \n\n*Metadata*: \`{teamId: ${teamId}, userId: ${userId}}\``,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
