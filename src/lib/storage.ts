import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

const s3 = new S3Client({
  region: env.STORAGE_REGION,
  endpoint: env.STORAGE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
});

export const STORAGE = {
  publicBucket: env.STORAGE_PUBLIC_BUCKET,
  privateBucket: env.STORAGE_PRIVATE_BUCKET,
  publicBaseUrl: env.STORAGE_PUBLIC_URL.replace(/\/$/, ""),
};

export async function uploadPublicObject(input: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  await s3.send(
    new PutObjectCommand({
      Bucket: STORAGE.publicBucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${STORAGE.publicBaseUrl}/${input.key}`;
}

export async function uploadPrivateObject(input: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  await s3.send(
    new PutObjectCommand({
      Bucket: STORAGE.privateBucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "private, max-age=0, no-store",
    }),
  );
}

export async function getPrivateObject(input: { key: string }) {
  return s3.send(
    new GetObjectCommand({
      Bucket: STORAGE.privateBucket,
      Key: input.key,
    }),
  );
}

export async function getSignedPrivateUrl(input: {
  key: string;
  expiresInSeconds?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: STORAGE.privateBucket,
    Key: input.key,
  });
  return getSignedUrl(s3, command, {
    expiresIn: input.expiresInSeconds ?? 300,
  });
}
