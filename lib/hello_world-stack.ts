import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';


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

    const helloLambda = new NodejsFunction(this, 'HelloLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/index.ts'),
    });

    const api = new apigateway.LambdaRestApi(this, 'HelloApi', {
      handler: helloLambda,
      proxy: true,
    });

    const emailTopic = new sns.Topic(this, 'EmailTopic', {
      displayName: 'Outreach Email Topic',
    });
    emailTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('ben.swift43@gmail.com')
    );

    const outreachEventsTable = new dynamodb.Table(this, 'OutreachEventsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const getOutreachEventsLambda = new NodejsFunction(this, 'GetOutreachEventsLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/getOutreachEvents/index.ts'),
      environment: {
        TABLE_NAME: outreachEventsTable.tableName,
      },
    });
    outreachEventsTable.grantReadData(getOutreachEventsLambda);

    const outreachEventsApi = new apigateway.LambdaRestApi(this, 'OutreachEventsApi', {
      handler: getOutreachEventsLambda,
      proxy: true,
    });

    const outreachChampionsTable = new dynamodb.Table(this, 'OutreachChampionsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const getOutreachChampionsLambda = new NodejsFunction(this, 'GetOutreachChampionsLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/getOutreachChampions/index.ts'),
      environment: {
        TABLE_NAME: outreachChampionsTable.tableName,
      },
    });
    outreachChampionsTable.grantReadData(getOutreachChampionsLambda);

    const outreachChampionsApi = new apigateway.LambdaRestApi(this, 'OutreachChampionsApi', {
      handler: getOutreachChampionsLambda,
      proxy: true,
    });

    const addOutreachEventLambda = new NodejsFunction(this, 'AddOutreachEventLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/addOutreachEvent/index.ts'),
      environment: {
        TABLE_NAME: outreachEventsTable.tableName,
        EMAIL_TOPIC_ARN: emailTopic.topicArn,
      },
    });
    outreachEventsTable.grantWriteData(addOutreachEventLambda);
    emailTopic.grantPublish(addOutreachEventLambda);

    const addOutreachEventApi = new apigateway.LambdaRestApi(this, 'AddOutreachEventApi', {
      handler: addOutreachEventLambda,
      proxy: true,
    });

    const addOutreachChampionLambda = new NodejsFunction(this, 'AddOutreachChampionLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/addOutreachChampion/index.ts'),
      environment: {
        TABLE_NAME: outreachChampionsTable.tableName,
      },
    });
    outreachChampionsTable.grantWriteData(addOutreachChampionLambda);

    const addOutreachChampionApi = new apigateway.LambdaRestApi(this, 'AddOutreachChampionApi', {
      handler: addOutreachChampionLambda,
      proxy: true,
    });

    const removeOutreachEventLambda = new NodejsFunction(this, 'RemoveOutreachEventLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/removeOutreachEvent/index.ts'),
      environment: {
        TABLE_NAME: outreachEventsTable.tableName,
      },
    });
    outreachEventsTable.grantWriteData(removeOutreachEventLambda);

    const removeOutreachEventApi = new apigateway.LambdaRestApi(this, 'RemoveOutreachEventApi', {
      handler: removeOutreachEventLambda,
      proxy: true,
    });

    const updateOutreachEventLambda = new NodejsFunction(this, 'UpdateOutreachEventLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/updateOutreachEvent/index.ts'),
      environment: {
        TABLE_NAME: outreachEventsTable.tableName,
      },
    });
    outreachEventsTable.grantWriteData(updateOutreachEventLambda);

    const updateOutreachEventApi = new apigateway.LambdaRestApi(this, 'UpdateOutreachEventApi', {
      handler: updateOutreachEventLambda,
      proxy: true,
    });

    // Single deployment for site assets + generated config so prune doesn't delete either.
    new s3deploy.BucketDeployment(this, 'DeployHelloWorld', {
      sources: [
      s3deploy.Source.asset(path.join(__dirname, '../outreach-hub')),
      s3deploy.Source.data('config.js', `window.OUTREACH_API_URL = ${JSON.stringify(outreachEventsApi.url)};\nwindow.OUTREACH_CHAMPIONS_API_URL = ${JSON.stringify(outreachChampionsApi.url)};\nwindow.ADD_OUTREACH_EVENT_API_URL = ${JSON.stringify(addOutreachEventApi.url)};\nwindow.REMOVE_OUTREACH_EVENT_API_URL = ${JSON.stringify(removeOutreachEventApi.url)};\nwindow.UPDATE_OUTREACH_EVENT_API_URL = ${JSON.stringify(updateOutreachEventApi.url)};\nwindow.ADD_OUTREACH_CHAMPION_API_URL = ${JSON.stringify(addOutreachChampionApi.url)};`),
      ],
      destinationBucket: helloWorldBucket,
    });
  }

}
