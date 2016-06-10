"use strict";

var path = require('path');
var readFileSync = require('fs').readFileSync;
var mkdirSync = require('fs').mkdirSync;
var exec = require('mz/child_process').exec;
var configAws = require('../aws').configAws;
var Lambda = require('../aws/lambda');
var S3 = require('../aws/s3');
var loadConfig = require('../util/config');

// This command sends the package.json file
// to the build server, downloads the
// resulting node_modules zip file, and 
// unzips it
//
// The workflow is:
//
// 1. Create temp dir
// 2. Invoke build server with package.json
// 3. Download node_modules.zip from S3
// 4. Unzip node_modules.zip to CWD
// 5. Clean up S3 file
// 6. Clean up temp dir

module.exports = function(dir) {
    var config = loadConfig(dir);
    var region = config.region;
    var buildFuncName = config.buildFuncName;

    configAws(dir);

    var lambda = new Lambda(region);
    var s3 = new S3(region);
    var s3Bucket;
    var s3Key;

    var cwd = dir ? path.join(process.cwd(), dir) : process.cwd();
    var packageJson = JSON.parse(readFileSync(path.join(cwd, 'package.json')));
    var nolaTempDir = path.join(cwd, '.nola-temp');
    var zipPath = path.join(nolaTempDir, 'node_modules.zip');

    //
    // (1)
    //
    try {
        mkdirSync(nolaTempDir);
    } catch(e) { }

    //
    // (2)
    //
    var payload = {
        packageJson: packageJson
    };

    return lambda.invoke(buildFuncName, payload).then(function(response) {
        if (response.error) {
            throw new Error(response.message);
        }

        //
        // (3)
        //
        s3Bucket = response.bucket;
        s3Key = response.key;

        return s3.download({
            bucket: s3Bucket,
            key: s3Key,
            destination: zipPath
        });
    }).then(function() {
        //
        // (4)
        //
        var cmdUnzip = 'unzip -q node_modules.zip -d ' + cwd;
        return exec(cmdUnzip, {
            cwd: nolaTempDir
        });
    }).then(function() {
        //
        // (5)
        //
        return s3.remove({
            bucket: s3Bucket,
            key: s3Key
        });
    }).then(function() {
        //
        // (6)
        //
        var cmdUnzip = 'rm -r ' + nolaTempDir;
        return exec(cmdUnzip, {
            cwd: cwd
        });
    }).catch(function(err) {
        console.log('Error building node_modules.');
        console.log(err.stack);
        process.exit(1);
    });
};