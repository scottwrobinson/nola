"use strict";

var assert = require('assert');
var writeFile = require('mz/fs').writeFile;
var AWS = require('aws-sdk');

class S3 {
    constructor(region) {
        this.s3 = new AWS.S3({
            apiVersion: '2006-03-01',
            region: region
        });
    }

    download(params) {
        var s3 = this.s3;

        return new Promise(function(resolve, reject) {
            var lamparams = {
                Bucket: params.bucket,
                Key: params.key
            };

            s3.getObject(lamparams, function(err, data) {
                if (err) reject(err);
                resolve(data);
            });
        }).then(function(data) {
            return writeFile(params.destination, data.Body);
        });
    }

    remove(params) {
        var s3 = this.s3;

        return new Promise(function(resolve, reject) {
            var lamparams = {
                Bucket: params.bucket,
                Key: params.key
            };

            s3.deleteObject(lamparams, function(err, data) {
                if (err) reject(err);
                resolve(data);
            });
        });
    }
}

module.exports = S3;