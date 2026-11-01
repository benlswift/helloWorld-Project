import { S3Client, GetObjectCommand, paginateListObjectsV2 } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({});
const bucketName = process.env.BUCKET_NAME!;

interface S3Object {
  key: string;
  size: number;
  lastModified: string;
  url?: string;
}

export const handler = async (event: { queryStringParameters?: { prefix?: string } | null }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const prefix = event.queryStringParameters?.prefix || '';
    const objects: S3Object[] = [];

    const paginator = paginateListObjectsV2({ client: s3Client }, { Bucket: bucketName, Prefix: prefix });

    for await (const page of paginator) {
      if (page.Contents) {
        for (const obj of page.Contents) {
          if (obj.Key) {
            const signedUrl = await getSignedUrl(
              s3Client,
              new GetObjectCommand({ Bucket: bucketName, Key: obj.Key }),
              { expiresIn: 3600 }
            );

            objects.push({
              key: obj.Key,
              size: obj.Size || 0,
              lastModified: obj.LastModified?.toISOString() || '',
              url: signedUrl,
            });
          }
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        bucket: bucketName,
        prefix: prefix || 'root',
        count: objects.length,
        objects,
      }),
      headers,
    };
  } catch (error) {
    console.error('Error fetching S3 resources:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error fetching S3 resources',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      headers,
    };
  }
};
