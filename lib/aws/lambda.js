"use strict";

var assert = require('assert');
var AWS = require('aws-sdk');

class Lambda {
    constructor(region) {
        assert(region);

        this.lambda = new AWS.Lambda({
            apiVersion: '2015-03-31',
            region: region
        });
    }

    listFunctions() {
        var lambda = this.lambda;

        var lamparams = {};

        return new Promise(function(resolve, reject) {
            lambda.listFunctions(lamparams, function(err, data) {
                if (err) return reject(err);
                resolve(data.Functions);
            });
        });
    }

    deploy(params) {
        var that = this;

        assert(params.zip);
        assert(params.role);

        params.name = params.name || 'nola-builder';
        params.handler = params.handler || 'index.handle';
        params.runtime = params.runtime || 'nodejs4.3';
        params.description = params.description || 'nola deployment';
        params.timeout = params.timeout || 3;

        // If function doesn't exist, create it, otherwise
        // update its code and configurations
        return this.listFunctions().then(function(functions) {
            if (that._hasFunction(functions, params.name)) {
                return that._updateFunctionCode(params).then(function() {
                    return that._updateFunctionConfiguration(params);
                });
            } else {
                return that._createFunction(params);
            }
        });        
    }

    invoke(name, payload) {
        var lambda = this.lambda;

        return new Promise(function(resolve, reject) {
            var params = {
                FunctionName: name,
                Payload: JSON.stringify(payload),
                LogType: 'Tail'
            };

            lambda.invoke(params, function(err, data) {
                if (err) return reject(err);

                // Decode log message
                //var log = new Buffer(data.LogResult, "base64").toString();

                var payload = JSON.parse(data.Payload);
                resolve(payload);
            });
        });
    }

    _createFunction(params) {
        var lambda = this.lambda;

        var lamparams = {
            Code: {
                ZipFile: params.zip
            },
            FunctionName: params.name,
            Handler: params.handler,
            Role: params.role,
            Runtime: params.runtime,
            Description: params.description,
            Timeout: params.timeout,
        };

        return new Promise(function(resolve, reject) {
            lambda.createFunction(lamparams, function(err, data) {
                if (err) return reject(err);
                resolve(data);
            });
        });
    }

    _updateFunctionCode(params) {
        var lambda = this.lambda;

        var lamparams = {
            ZipFile: params.zip,
            FunctionName: params.name
        };

        return new Promise(function(resolve, reject) {
            lambda.updateFunctionCode(lamparams, function(err, data) {
                if (err) return reject(err);
                resolve(data);
            });
        });
    }

    _updateFunctionConfiguration(params) {
        var lambda = this.lambda;

        var lamparams = {
            FunctionName: params.name,
            Handler: params.handler,
            Role: params.role,
            Runtime: params.runtime,
            Description: params.description,
            Timeout: params.timeout,
        };

        return new Promise(function(resolve, reject) {
            lambda.updateFunctionConfiguration(lamparams, function(err, data) {
                if (err) return reject(err);
                resolve(data);
            });
        });
    }

    _hasFunction(functions, targetName) {
        for (let i = 0; i < functions.length; i++) {
            if (functions[i].FunctionName === targetName) {
                return true;
            }
        }

        return false;
    }
}

module.exports = Lambda;
