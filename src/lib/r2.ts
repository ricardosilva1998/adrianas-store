import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicUrl = process.env.R2_PUBLIC_URL;

export const r2Configured = Boolean(
  accountId && accessKeyId && secretAccessKey && bucket && publicUrl,
);

const client = r2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    })
  : null;

export const uploadMedia = async (
  file: Buffer,
  contentType: string,
  filename: string,
): Promise<string> => {
  if (!client || !bucket || !publicUrl) {
    throw new Error(
      "Cloudflare R2 não configurado. Define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL.",
    );
  }

  const isVideo = contentType.startsWith("video/");
  const prefix = isVideo ? "products/videos" : "products";
  const key = `${prefix}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
};

export const uploadImage = uploadMedia;

export const uploadPersonalizationFile = async (
  file: Buffer,
  contentType: string,
  filename: string,
): Promise<string> => {
  if (!client || !bucket || !publicUrl) {
    throw new Error(
      "Cloudflare R2 não configurado. Define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL.",
    );
  }

  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 80) || "file";
  const key = `personalizations/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      // Customer attachments are not immutable assets; keep cache short so we
      // can repurpose keys safely in the future.
      CacheControl: "private, max-age=86400",
    }),
  );

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
};
