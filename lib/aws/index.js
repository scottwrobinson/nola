"use strict";

var AWS = require('aws-sdk');
var loadConfig = require('../util/config');

var configAws = function(dir) {
    var config = loadConfig(dir);

    // Tell AWS SDK which profile to use
    if (config.profile) {
        var credentials = new AWS.SharedIniFileCredentials({profile: config.profile});
        AWS.config.credentials = credentials;
    }
};

exports.configAws = configAws;
exports.lambda = require('./lambda');
exports.s3 = require('./s3');