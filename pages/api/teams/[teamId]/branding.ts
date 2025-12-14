import { NextApiRequest, NextApiResponse } from "next";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";

import { errorhandler } from "@/lib/errorHandler";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { CustomUser } from "@/lib/types";

import { authOptions } from "../../auth/[...nextauth]";

// Helper to delete asset (handles both Vercel Blob and S3)
async function deleteAsset(url: string | null, teamId: string) {
  if (!url) return;

  try {
    // Check if it's an S3 asset URL (our proxy endpoint)
    if (url.includes("/api/file/s3/serve-asset?key=")) {
      const keyMatch = url.match(/[?&]key=([^&]+)/);
      if (keyMatch) {
        const key = decodeURIComponent(keyMatch[1]);
        const { client, config } = await getTeamS3ClientAndConfig(teamId);
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: key,
          }),
        );
      }
    } else if (url.startsWith("https://") && !url.includes("/api/")) {
      // Assume it's a Vercel Blob URL
      await del(url);
    }
  } catch (error) {
    // Log but don't throw - we still want to delete the database record
    console.error("[Delete Asset Error]", error);
  }
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).end("Unauthorized");
  }

  const { teamId } = req.query as { teamId: string };

  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
        users: { select: { userId: true } },
      },
    });

    // check that the user is member of the team, otherwise return 403
    const teamUsers = team?.users;
    const isUserPartOfTeam = teamUsers?.some(
      (user) => user.userId === (session.user as CustomUser).id,
    );
    if (!isUserPartOfTeam) {
      return res.status(403).end("Unauthorized to access this team");
    }
  } catch (error) {
    errorhandler(error, res);
  }

  if (req.method === "GET") {
    // GET /api/teams/:teamId/branding
    const brand = await prisma.brand.findUnique({
      where: {
        teamId: teamId,
      },
    });

    if (!brand) {
      return res.status(200).json(null);
    }

    return res.status(200).json(brand);
  } else if (req.method === "POST") {
    // POST /api/teams/:teamId/branding
    const { logo, banner, brandColor, accentColor, welcomeMessage } = req.body as {
      logo?: string;
      banner?: string;
      brandColor?: string;
      accentColor?: string;
      welcomeMessage?: string;
    };

    // update team with new branding
    const brand = await prisma.brand.create({
      data: {
        logo: logo,
        banner,
        brandColor,
        accentColor,
        welcomeMessage,
        teamId: teamId,
      },
    });

    // Cache the logo URL in Redis if logo exists
    if (logo) {
      await redis.set(`brand:logo:${teamId}`, logo);
    }

    return res.status(200).json(brand);
  } else if (req.method === "PUT") {
    // PUT /api/teams/:teamId/branding
    const { logo, banner, brandColor, accentColor, welcomeMessage } = req.body as {
      logo?: string;
      banner?: string;
      brandColor?: string;
      accentColor?: string;
      welcomeMessage?: string;
    };

    // Use upsert to handle both create and update cases
    const brand = await prisma.brand.upsert({
      where: {
        teamId: teamId,
      },
      create: {
        logo,
        banner,
        brandColor,
        accentColor,
        welcomeMessage,
        teamId: teamId,
      },
      update: {
        logo,
        banner,
        brandColor,
        accentColor,
        welcomeMessage,
      },
    });

    // Update logo in Redis cache
    if (logo) {
      await redis.set(`brand:logo:${teamId}`, logo);
    } else {
      // If logo is null or undefined, delete the cache
      await redis.del(`brand:logo:${teamId}`);
    }

    return res.status(200).json(brand);
  } else if (req.method === "DELETE") {
    // DELETE /api/teams/:teamId/branding
    const brand = await prisma.brand.findFirst({
      where: {
        teamId: teamId,
      },
      select: { id: true, logo: true, banner: true },
    });

    if (brand) {
      // delete the logo and banner from storage (S3 or Vercel Blob)
      await deleteAsset(brand.logo, teamId);
      await deleteAsset(brand.banner, teamId);
    }

    // delete the branding from database
    await prisma.brand.delete({
      where: {
        id: brand?.id,
      },
    });

    // Remove logo from Redis cache
    await redis.del(`brand:logo:${teamId}`);

    return res.status(204).end();
  } else {
    // We only allow GET and DELETE requests
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
