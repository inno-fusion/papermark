import { NextApiRequest, NextApiResponse } from "next";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ONE_HOUR, ONE_SECOND } from "@/lib/constants";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";

// Serve S3 assets via redirect to presigned URL
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).end("Method Not Allowed");
  }

  const { key } = req.query;

  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "Missing key parameter" });
  }

  // Decode the key (it may be URL encoded)
  const decodedKey = decodeURIComponent(key);

  // Validate that the key looks like an asset path
  if (!decodedKey.includes("/assets/")) {
    return res.status(403).json({ error: "Invalid asset path" });
  }

  // Extract teamId from key (format: {teamId}/assets/{assetId}/{filename})
  const teamId = decodedKey.split("/")[0];
  if (!teamId) {
    return res.status(400).json({ error: "Invalid key format" });
  }

  try {
    const { client, config } = await getTeamS3ClientAndConfig(teamId);

    const getObjectCommand = new GetObjectCommand({
      Bucket: config.bucket,
      Key: decodedKey,
    });

    const presignedUrl = await getSignedUrl(client, getObjectCommand, {
      expiresIn: ONE_HOUR / ONE_SECOND,
    });

    // Redirect to the presigned URL
    return res.redirect(307, presignedUrl);
  } catch (error) {
    console.error("[S3 Serve Asset Error]", error);
    return res.status(500).json({
      error: "Failed to serve asset",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
