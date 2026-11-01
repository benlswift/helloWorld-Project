import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});
const bucketName = process.env.BUCKET_NAME!;

interface UploadEvent {
  httpMethod?: string;
  queryStringParameters?: { prefix?: string; fileName?: string } | null;
  headers?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export const handler = async (event: UploadEvent) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'OPTIONS,POST' },
      body: JSON.stringify({ message: 'Use POST to upload a file' }),
    };
  }

  const prefix = event.queryStringParameters?.prefix?.replace(/\/+$/, '') || '';
  const fileName = event.queryStringParameters?.fileName || '';
  if (!prefix || prefix.split('/').some(part => !part.trim() || part === '.' || part === '..') ||
      !fileName.trim() || /[/\\]/.test(fileName) || fileName === '.' || fileName === '..') {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ message: 'A folder prefix and a fileName without path separators are required' }),
    };
  }
  if (event.body == null) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'File contents are required in the request body' }) };
  }
  if (event.isBase64Encoded && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(event.body)) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid base64 file contents' }) };
  }

  const key = `${prefix}/${fileName}`;
  if (Buffer.byteLength(key, 'utf8') > 1024) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'The S3 object key must not exceed 1024 bytes' }) };
  }
  const body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  const contentType = Object.entries(event.headers || {})
    .find(([name]) => name.toLowerCase() === 'content-type')?.[1] || 'application/octet-stream';

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ bucket: bucketName, prefix, key, size: body.length }),
    };
  } catch (error) {
    console.error('Error uploading S3 resource:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Error uploading S3 resource' }),
    };
  }
};
