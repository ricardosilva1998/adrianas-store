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

export const uploadImage = async (
  file: Buffer,
  contentType: string,
  filename: string,
): Promise<string> => {
  if (!client || !bucket || !publicUrl) {
    throw new Error(
      "Cloudflare R2 não configurado. Define R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL.",
    );
  }

  const key = `products/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

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
