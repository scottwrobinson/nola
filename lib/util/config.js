"use strict";

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var load = function(dir) {
    var config = {};

    var configPath = dir ? path.join(process.cwd(), dir, '.nola') :
                           path.join(process.cwd(), '.nola');

    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Verify we have required info
        assert(config.role, 'AWS \'role\' not set in .nola config file');
    } catch(e) {
        if (e instanceof assert.AssertionError) {
            console.log('Error:', e.message);
            process.exit(1);
        }
    }

    // Add defaults
    config.region = config.region || 'us-east-1';
    config.buildFuncName = config.buildFuncName || 'nola-builder';

    return config;
};

module.exports = load;
