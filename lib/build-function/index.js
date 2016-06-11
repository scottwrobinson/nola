"use strict";

var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var util = require('util');
var AWS = require('aws-sdk');

//
// Runs on AWS Lambda
//

var CWD = __dirname;

// Since bucket names must be globally unique,
// create name using access key ID
var awsAccessId = process.env.AWS_ACCESS_KEY_ID;
var BUCKET = 'nola-' + awsAccessId.substring(awsAccessId.length-10, awsAccessId.length);

// Unix 'zip' is not installed, so we'll use Python
var ZIP_CMD = "python -c \"import shutil; shutil.make_archive('%s', 'zip', '%s', 'node_modules')\"";

// To avoid node-gyp using the home dir, we need to
// give it the location of the some Node source files
var NPM_CACHE = '/tmp/.npm';
var NODE_SOURCES_CFG = 'npm_config_nodedir=' + path.join(CWD, 'node-source');
var NPM_CACHE_CFG = 'npm_config_cache=' + NPM_CACHE;

//
// Promisify built-in functions
//
// We don't want to require any libraries to
// do this for us since it complicates the
// server deployment, we'll just write the 
// code ourselves.
//

var mkdir = function(path) {
    return new Promise(function(resolve, reject) {
        fs.mkdir(path, function(err) {
            if (err) return reject(err);
            resolve();
        });
    });
};

var writeFile = function(path, content) {
    return new Promise(function(resolve, reject) {
        fs.writeFile(path, content, function(err) {
            if (err) return reject(err);
            resolve();
        });
    });
};

var exec = function(command, options) {
    return new Promise(function(resolve, reject) {
        child_process.exec(command, options, function(err, stdout, stderr) {
            console.log('stdout:', stdout);
            if (err) return reject(err);
            resolve();
        });
    });
};

var s3CreateBucket = function(s3, bucket) {
    var params = {
        Bucket: bucket,
        ACL: 'private',
    };

    return new Promise(function(resolve, reject) {
        s3.createBucket(params, function(err, data) {
            if (err) return reject(err);
            resolve(data);
        });
    });
};

var s3BucketExists = function(s3, bucket) {
    return new Promise(function(resolve, reject) {
        s3.listBuckets(function(err, data) {
            if (err) return reject(err);

            for (let i = 0; i < data.Buckets.length; i++) {
                if (data.Buckets[i].Name === bucket) {
                    return resolve(true);
                }
            }
            
            return resolve(false);
        });
    });
};

var s3Upload = function(s3, params) {
    // Uploads file to S3 and waits for it to finish
    return new Promise(function(resolve, reject) {
        var upParams = {
            Bucket: params.bucket,
            Key: params.key,
            Body: params.body
        };

        s3.upload(upParams, function(err, upData) {
            if (err) return reject(err);

            var waitParams = {
                Bucket: params.bucket,
                Key: params.key,
            };

            s3.waitFor('objectExists', waitParams, function(err, waitData) {
                if (err) reject(err);
                resolve(upData.Location);
            });
        });
    });
};

var sendFileToS3 = function(s3, params) {
    return s3BucketExists(s3, params.bucket).then(function(exists) {
        if (!exists) {
            return s3CreateBucket(s3, params.bucket);
        }

        return Promise.resolve();
    }).then(function() {
        return s3Upload(s3, params);
    });
};

// This is the main entry point that Lambda invokes to handle the
// request to build the provided packages.
//
// The workflow is:
//
// 1. Create /tmp/<request-id>/
// 2. Copy the provided package.json to /tmp/<request-id>/package.json
// 3. Run npm install in that directory
// 4. Zip the resulting node_modules directory
// 5. Upload the zip file to <bucket>/<request-id>/node_modules.zip
// 6. Clean up temp directory and npm cache
// 7.1 Return location of node_modules.zip on S3
// 7.2 Return error

exports.handle = function(event, ctx, cb) {
    var requestId = ctx.awsRequestId;
    var packageJson = event.packageJson;

    console.log('Request ID:', requestId);

    var tmpDir = path.join('/tmp/', requestId);
    var zipDest = path.join(tmpDir, 'node_modules');
    var zipPath = path.join(tmpDir, 'node_modules.zip');

    // Var used to return zip contents on completion
    var zipKey;
    var zipS3Location;

    console.log('Building node_modules for ' + packageJson.name + '@' + packageJson.version);

    //
    // (1)
    //
    return mkdir(tmpDir).then(function() {
        //
        // (2)
        //
        var packageJSONPath = path.join(tmpDir, 'package.json');

        return writeFile(packageJSONPath, JSON.stringify(packageJson));
    }).then(function() {
        console.log('Installing dependencies');

        //
        // (3)
        //
        var cmdInstall = NODE_SOURCES_CFG + ' ' + NPM_CACHE_CFG + ' npm install --production';

        return exec(cmdInstall, {
            cwd: tmpDir
        });
    }).then(function() {
        console.log('Zipping node_modules');

        //
        // (4)
        //
        var cmdZip = util.format(ZIP_CMD, zipDest, tmpDir);

        return exec(cmdZip, {
            cwd: tmpDir
        });
    }).then(function() {
        //
        // (5)
        //
        var s3 = new AWS.S3();
        var stream = fs.createReadStream(zipPath);
        var key = requestId + '/node_modules.zip';
        zipKey = key;

        console.log('Uploading to S3: bucket=' + BUCKET, 'key=' + key);

        var params = {
            bucket: BUCKET,
            key: key,
            body: stream
        };

        return sendFileToS3(s3, params);
    }).then(function(s3Location) {
        zipS3Location = s3Location;

        console.log('Cleaning up temp directory:', tmpDir);

        //
        // (6)
        //
        return exec('rm -rf ' + tmpDir + ' ' + NPM_CACHE);
    }).then(function() {
        console.log('Successfully built node_modules');

        //
        // (7.1)
        //
        cb(null, {
            error: false,
            message: 'success',
            url: zipS3Location,
            bucket: BUCKET,
            key: zipKey
        });
    }).catch(function(err) {
        console.log('ERROR building node_modules.');
        console.log(err.stack);

        //
        // (7.2)
        //
        cb(null, {
            error: true,
            message: err.message,
            url: null,
            bucket: null,
            key: null
        });
    });
};