# Nola

**No**de **La**mbda Packager

_Builds node\_modules for Lambda, using Lambda_

Based on [lambda-packager](https://github.com/tomdale/lambda-packager) by [Tom Dale](https://github.com/tomdale).

## Motivation
[AWS Lambda](https://aws.amazon.com/lambda/) is a serverless computing infrastructure that allows you to run code in the cloud without having to manage servers. Lambda handles the deployment, management, and scaling of your code using its own Amazon Linux machines.

While this solves many problems for developers, it also presents a few new problems. Since all of your code must be uploaded to Lambda, (including dependencies) you can't build/package any code directly on the servers. And since quite a few Node packages compile native C/C++ extensions during install, anything you package on your Mac or Windows machine won't work on Lambda servers.

This is where Nola comes in. It is a utility that utilizes Lambda servers to build packages for you, ensuring any native extensions have been compiled for the correct target system. It works by:

- Installing a build server on Lambda (only once)
- Sends your package.json to the build server
- Creates node_modules using `npm install` on the build server
- Zips and sends node_modules to S3
- Downloads and unzips node_modules.zip from S3

This is all done using your own AWS infrastructure.

## Install
Install globally using npm:

```bash
$ npm install -g nola
```

Since Nola uses the aws-sdk, you need to provide it with your AWS credentials. Follow [this AWS configuration guide](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html) to get it set up. I find it easiest to use the shared credentials file in `~/.aws/credentials`.

You also might need to set up a new IAM role for the build server. It should have one of the Lamda execution policies (like AWSLambdaVPCAccessExecutionRole) and an S3 access policy (like AmazonS3FullAccess).

## Usage
Before you can start building packages with Nola, **you must install the build server first**. To do this, create a `.nola` file in your current project and add the following info:

```json
{
    "role": "arn:aws:iam::<AWS_ID>:role/<AWS_ROLE_NAME>",   // REQUIRED
    "region": "<AWS_REGION>",                               // OPTIONAL
    "profile": "<AWS_PROFILE_NAME>"                         // OPTIONAL
}
```

Then, in the same directory as your `.nola` file, run:

```bash
$ nola deploy
```

This only needs to be done the first time you install `nola`, and whenever you upgrade versions.

### Command Line
Currently there are only two commands - `deploy` and `build`.

**Deploy**

Deploys the build server to AWS Lambda.

```bash
$ nola deploy
```

**Build**

Builds your project using package.json and the Lambda build server.

```bash
$ nola build
```

To specify a project that isn't in your working directory:

```bash
$ nola build my-project/
```

## In Progress
This is an early version of Nola, so there are still quite a few features that need to be implemented. Some of the planned features are:

- Better programmatic interface
- More configuration options
  + Specify S3 bucket name
  + SSH keys to upload for private git repos
- Cache node_modules to avoid duplicate and unnecessary builds
- "Undeploy" method to remove build server

## Contact
You can contact me with questions, issues, or ideas at either of the following:

- Email: [s.w.robinson+nola@gmail.com](mailto:s.w.robinson+nola@gmail.com)
- Twitter: [@ScottWRobinson](https://twitter.com/ScottWRobinson)

For short questions and faster responses, try Twitter.

## Copyright & License
Copyright (c) 2016 Scott Robinson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
