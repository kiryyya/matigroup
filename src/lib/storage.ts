import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

// Lazy initialization to avoid errors during build when env vars are not available
let s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3) {
    // During build, env might not be available
    if (process.env.SKIP_ENV_VALIDATION === "true" && !env.STORAGE_ENDPOINT) {
      // Return a dummy client that will fail at runtime but not during build
      s3 = new S3Client({
        region: "us-east-1",
        endpoint: "http://localhost",
        forcePathStyle: true,
        credentials: {
          accessKeyId: "dummy",
          secretAccessKey: "dummy",
        },
      });
    } else {
      s3 = new S3Client({
        region: env.STORAGE_REGION,
        endpoint: env.STORAGE_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: env.STORAGE_ACCESS_KEY,
          secretAccessKey: env.STORAGE_SECRET_KEY,
        },
      });
    }
  }
  return s3;
}

// Lazy initialization to avoid errors during build
function getStorageConfig() {
  if (process.env.SKIP_ENV_VALIDATION === "true" && !env.STORAGE_PUBLIC_BUCKET) {
    return {
      publicBucket: "dummy",
      privateBucket: "dummy",
      publicBaseUrl: "http://localhost",
    };
  }
  return {
    publicBucket: env.STORAGE_PUBLIC_BUCKET,
    privateBucket: env.STORAGE_PRIVATE_BUCKET,
    publicBaseUrl: env.STORAGE_PUBLIC_URL.replace(/\/$/, ""),
  };
}

export const STORAGE = getStorageConfig();

export async function uploadPublicObject(input: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: STORAGE.publicBucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: "public, max-age=31536000, immutable",
        // Устанавливаем ACL для публичного доступа (если поддерживается Selectel)
        ACL: "public-read",
      }),
    );
  } catch (error) {
    // Если ACL не поддерживается, пробуем без него
    if (error instanceof Error && (error.message.includes('ACL') || error.message.includes('InvalidArgument'))) {
      console.warn("ACL not supported, uploading without ACL");
      await getS3Client().send(
        new PutObjectCommand({
          Bucket: STORAGE.publicBucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    } else {
      throw error;
    }
  }

  // Используем прокси через API вместо прямого доступа к Selectel
  // Это решает проблему с 403 ошибками, когда бакет не публичный
  // На сервере используем абсолютный URL из переменной окружения или дефолтный
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://matigroup-test-bot.ru';
  
  return `${baseUrl}/api/images/${input.key}`;
}

export async function uploadPrivateObject(input: {
  key: string;
  body: Uint8Array;
  contentType: string;
}) {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: STORAGE.privateBucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "private, max-age=0, no-store",
    }),
  );
}

export async function getPublicObject(input: { key: string }) {
  return getS3Client().send(
    new GetObjectCommand({
      Bucket: STORAGE.publicBucket,
      Key: input.key,
    }),
  );
}

export async function getPrivateObject(input: { key: string }) {
  return getS3Client().send(
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
  return getSignedUrl(getS3Client(), command, {
    expiresIn: input.expiresInSeconds ?? 300,
  });
}
