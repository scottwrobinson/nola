"use strict";

var path = require('path');
var mkdir = require('mz/fs').mkdir;
var readFile = require('mz/fs').readFile;
var exec = require('mz/child_process').exec;
var configAws = require('../aws').configAws;
var Lambda = require('../aws/lambda');
var loadConfig = require('../util/config');

var cwd = __dirname;

var buildServerPath = path.join(cwd, '../build-function');
var nolaTempDir = path.join(cwd, '../../.nola');
var zipPath = path.join(nolaTempDir, 'builder.zip');

// This command packages the Lambda build
// server and uploads it to Lambda.
//
// The workflow is:
//
// 1. Create temp dir
// 2. Zip up build server code in temp dir
// 3. Upload zipped code to Lambda
// 4. Clean up temp dir

module.exports = function() {
    configAws();
    
    var config = loadConfig();
    var region = config.region;
    var role = config.role;
    var buildFuncName = config.buildFuncName;

    //
    // (1)
    //
    return mkdir(nolaTempDir).then(function() {
        //
        // (2)
        //
        var cmdZip = 'zip -qrj ' + zipPath + ' ' + buildServerPath;
        return exec(cmdZip, {
            cwd: cwd
        });
    }).then(function() {
        //
        // (3)
        //
        return readFile(zipPath);
    }).then(function(zipBuffer) {
        var params = {
            zip: zipBuffer,
            name: buildFuncName,
            handler: 'index.handle',
            role: role,
            runtime: 'nodejs4.3',
            description: 'Nola build server',
            timeout: 300,
        };

        var lambda = new Lambda(region);
        return lambda.deploy(params);
    }).then(function() {
        //
        // (4)
        //
        var cmdRm = 'rm -r ' + nolaTempDir;
        return exec(cmdRm, {
            cwd: cwd
        });
    }).then(function() {
        console.log('Successfully deployed build server.');
    }).catch(function(err) {
        console.log('Error deploying build server.');
        console.log(err.stack);
        process.exit(1);
    });
};