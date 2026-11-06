# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   type-check the project
* `npm run watch`   watch for changes and type-check
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Upload event resources

The event page's upload form uses the event ID from its `id` query parameter
as `prefix` and the selected file's name as `fileName`. It sends the file
contents directly to `window.UPLOAD_RESOURCE_API_URL`, supplied by the
deployment's generated frontend config.

After deployment, use the `AddEventResourceApiUrl` output to POST raw file
contents with `prefix` and `fileName` query parameters:

```sh
curl --request POST \
  --header 'Content-Type: application/pdf' \
  --data-binary @agenda.pdf \
  'https://<api-id>.execute-api.<region>.amazonaws.com/prod/?prefix=event-123&fileName=agenda.pdf'
```

This writes `event-123/agenda.pdf` in the events bucket and returns HTTP 201
with `{ bucket, prefix, key, size }`. Reusing the same key overwrites the file.
The prefix is required; a trailing slash is optional. The file name must not
contain path separators. Empty files are supported.

The upload API passes binary bodies to Lambda as base64; the handler decodes
them before writing to S3. Keep uploads below Lambda's 6 MB synchronous payload
limit, allowing for base64 expansion and the API Gateway event envelope.

## Experimental Preact event page

The original event page is unchanged. The opt-in migration lives in
`frontend-event/` and is available at `experimental-event/index.html?id=<event-id>`
on the deployed website. It uses the same generated API configuration and CSS,
with typed API responses and Preact state for editing and resource management.
Success/error messages are displayed inline, and successful saves stay on the
experimental page. Resource uploads retain the browser's 4 MiB limit.

* `npm run build:event` type-checks and builds the experiment into
  `outreach-hub/experimental-event/` (ignored generated files).
* `npm run build` type-checks both backend and experimental frontend.
* `npm test -- --runInBand test/experimental-event.test.ts` tests the migration.
* `npx cdk deploy` builds the experiment automatically as part of the existing
  combined website deployment. Node and installed development dependencies are
  required on the machine synthesizing the stack.

For local testing, build the experiment and serve `outreach-hub/` using a local
static server. Supply `outreach-hub/config.js` with your deployed API URLs;
CDK normally generates that file during deployment. Do not put credentials in
the frontend configuration.

This is a UI migration only: it does not add authentication or resolve the
existing upload API authorization gap.
