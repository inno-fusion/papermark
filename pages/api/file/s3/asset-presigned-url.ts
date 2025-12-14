import { NextApiRequest, NextApiResponse } from "next";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import slugify from "@sindresorhus/slugify";
import { getServerSession } from "next-auth";
import path from "node:path";

import { ONE_HOUR, ONE_SECOND } from "@/lib/constants";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

import { authOptions } from "../../auth/[...nextauth]";

const uploadConfig = {
  profile: {
    allowedContentTypes: ["image/png", "image/jpg", "image/jpeg"],
    maximumSizeInBytes: 2 * 1024 * 1024, // 2MB
  },
  assets: {
    allowedContentTypes: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/svg+xml",
      "image/x-icon",
      "image/ico",
    ],
    maximumSizeInBytes: 5 * 1024 * 1024, // 5MB
  },
};

// Get presigned URL for uploading assets to S3
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).end("Unauthorized");
  }

  const { fileName, contentType, uploadType = "assets" } = req.body as {
    fileName: string;
    contentType: string;
    uploadType?: "profile" | "assets";
  };

  // Validate upload type
  if (!(uploadType in uploadConfig)) {
    return res.status(400).json({ error: "Invalid upload type specified." });
  }

  const config = uploadConfig[uploadType];

  // Validate content type
  if (!config.allowedContentTypes.includes(contentType)) {
    return res.status(400).json({
      error: `File type not allowed. Allowed types: ${config.allowedContentTypes.join(", ")}`,
    });
  }

  const userId = (session.user as CustomUser).id;

  // Get user's primary team
  const userTeam = await prisma.userTeam.findFirst({
    where: { userId },
    select: { teamId: true },
  });

  if (!userTeam) {
    return res.status(403).json({ error: "No team found for user" });
  }

  try {
    const { client, config: s3Config } = await getTeamS3ClientAndConfig(
      userTeam.teamId,
    );

    // Generate unique asset ID
    const assetId = crypto.randomUUID();

    // Get the basename and extension for the file
    const { name, ext } = path.parse(fileName);
    const slugifiedName = slugify(name) + ext;

    // Store assets in a dedicated assets folder
    const key = `${userTeam.teamId}/assets/${assetId}/${slugifiedName}`;

    const putObjectCommand = new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, putObjectCommand, {
      expiresIn: ONE_HOUR / ONE_SECOND,
    });

    // Construct the public URL for the uploaded file
    // Use proxy endpoint for S3 assets (handles presigned URLs automatically)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    const publicUrl = `${baseUrl}/api/file/s3/serve-asset?key=${encodeURIComponent(key)}`;

    return res.status(200).json({
      uploadUrl,
      publicUrl,
      key,
    });
  } catch (error) {
    console.error("[S3 Asset Presigned URL Error]", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
