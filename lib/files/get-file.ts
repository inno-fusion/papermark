import { DocumentStorageType } from "@prisma/client";
import { getDownloadUrl } from "@vercel/blob";
import { match } from "ts-pattern";

export type GetFileOptions = {
  type: DocumentStorageType;
  data: string;
  isDownload?: boolean;
};

export const getFile = async ({
  type,
  data,
  isDownload = false,
}: GetFileOptions): Promise<string> => {
  const url = await match(type)
    .with(DocumentStorageType.VERCEL_BLOB, () => {
      if (isDownload) {
        return getDownloadUrl(data);
      } else {
        return data;
      }
    })
    .with(DocumentStorageType.S3_PATH, async () => getFileFromS3(data))
    .exhaustive();

  return url;
};

const fetchPresignedUrl = async (
  endpoint: string,
  headers: Record<string, string>,
  key: string,
): Promise<string> => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    let errorMessage: string;

    if (contentType && contentType.includes("application/json")) {
      try {
        const error = await response.json();
        errorMessage =
          error.message || `Request failed with status ${response.status}`;
      } catch (parseError) {
        const textError = await response.text();
        errorMessage =
          textError || `Request failed with status ${response.status}`;
      }
    } else {
      const textError = await response.text();
      errorMessage =
        textError || `Request failed with status ${response.status}`;
    }

    throw new Error(errorMessage);
  }

  const { url } = (await response.json()) as { url: string };
  return url;
};

const getFileFromS3 = async (key: string) => {
  const isServer = typeof window === "undefined";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL;

  // Server-side (workers, API routes): use absolute URL with internal API key
  if (isServer && baseUrl) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add auth header if internal API key is available
    if (process.env.INTERNAL_API_KEY) {
      headers.Authorization = `Bearer ${process.env.INTERNAL_API_KEY}`;
    }

    return fetchPresignedUrl(
      `${baseUrl}/api/file/s3/get-presigned-get-url`,
      headers,
      key,
    );
  } else {
    // Client-side: use relative URL (proxy endpoint)
    return fetchPresignedUrl(
      `/api/file/s3/get-presigned-get-url-proxy`,
      {
        "Content-Type": "application/json",
      },
      key,
    );
  }
};
