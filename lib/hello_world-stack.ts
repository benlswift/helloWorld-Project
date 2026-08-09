import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import * as cloudformation from 'aws-cdk-lib/aws-cloudformation';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class HelloWorldStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const helloWorldBucket = new s3.Bucket(this, 'HelloWorldBucket', {
      websiteIndexDocument: 'index.html',
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    
    helloWorldBucket.addToResourcePolicy(new iam.PolicyStatement({
    actions: ['s3:GetObject'],
    resources: [`${helloWorldBucket.bucketArn}/*`],
    principals: [new iam.AnyPrincipal()],
    effect: iam.Effect.ALLOW,
  }));

    new s3deploy.BucketDeployment(this, 'DeployHelloWorld', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../site'))],
      destinationBucket: helloWorldBucket,
    });
  }


}
