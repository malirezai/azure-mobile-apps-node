// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// ----------------------------------------------------------------------------
/**
@module azure-mobile-apps/express
@description
This module is the entry point for adding an Azure Mobile App to an instance of
an express web server. It is returned from the root azure-mobile-apps module
when the configuration passed specifies the express platform.
*/
var express = require('express'),
    customApi = require('./api'),
    tables = require('./tables'),
    table = require('./tables/table'),
    log = require('../logger'),
    assert = require('../utilities/assert').argument;

/**
 * An {@link http://expressjs.com/4x/api.html#router express router} extended with the following properties
 * @typedef mobileAppRouter
 * @property {module:azure-mobile-apps/express/api} api - Contains functions to register api definitions with azure-mobile-apps
 * @property {module:azure-mobile-apps/express/tables} tables - Contains functions to register table definitions with azure-mobile-apps
 * @property {module:azure-mobile-apps/express/tables/table} table - Factory function for creating table definition objects
 * @property {configuration} configuration - Top level configuration that azure-mobile-apps was configured with
 */

/**
 * Creates an instance of the azure-mobile-apps server object for express 4.x
 * @param {configuration} configuration
 * @returns {mobileAppRouter}
 */
module.exports = function (configuration) {
    configuration = configuration || {};

    log.silly("Configured with the following values:\n" + JSON.stringify(configuration, null, 2));

    var tableMiddleware = tables(configuration),
        apiMiddleware = customApi(configuration),
        customMiddlewareRouter = express.Router(),
        mobileApp = express.Router();

    if(!configuration.hosted)
        mobileApp
            .use(middleware('crossOrigin'))
            .use(configuration.authStubRoute, middleware('authStub'));

    mobileApp
        .use(middleware('version'))
        .use(middleware('createContext'))
        .use(middleware('authenticate'))
        .use(customMiddlewareRouter)
        .use(configuration.notificationRootPath || '/push/installations', middleware('notifications'))
        .use(configuration.apiRootPath || '/api', apiMiddleware)
        .use(configuration.tableRootPath || '/tables', middleware('apiVersionCheck'), tableMiddleware, middleware('renderResults'));

    if(configuration.homePage)
        mobileApp.use('/', express.static(__dirname + '/../templates/static'));

    if(configuration.swagger)
        mobileApp.use(configuration.swaggerPath, middleware('swagger'));

    mobileApp.use(middleware('handleError'));

    var api = function (req, res, next) {
        mobileApp(req, res, next);
    };

    api.api = apiMiddleware;
    api.tables = tableMiddleware;
    api.table = table;
    api.configuration = configuration;
    api.use = function () {
        customMiddlewareRouter.use.apply(customMiddlewareRouter, arguments);
    }

    return api;

    function middleware(name) {
        return require('./middleware/' + name)(configuration);
    }
};

/**
Static factory function for creating table definition objects. Intended to be used from imported table configuration files.
@function
@returns {module:azure-mobile-apps/express/tables/table}
@example require('azure-mobile-apps/express').table();
*/
module.exports.table = table;
