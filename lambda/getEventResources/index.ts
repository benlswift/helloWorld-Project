import { S3Client, GetObjectCommand, paginateListObjectsV2 } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const s3Client = new S3Client({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bucketName = process.env.BUCKET_NAME!;
const tableName = process.env.TABLE_NAME!;

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
    const prefix = event.queryStringParameters?.prefix?.replace(/\/+$/, '') || '';
    if (!prefix || prefix.includes('/')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'An event prefix is required' }),
        headers,
      };
    }

    const eventRecord = await dynamoClient.send(new GetCommand({
      TableName: tableName,
      Key: { id: prefix },
      ProjectionExpression: 'id',
    }));
    if (!eventRecord.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Outreach event not found' }),
        headers,
      };
    }

    const objects: S3Object[] = [];

    const paginator = paginateListObjectsV2({ client: s3Client }, { Bucket: bucketName, Prefix: `${prefix}/` });

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
        prefix,
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
