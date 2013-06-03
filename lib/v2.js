/*!
 * knox - Client
 * Copyright(c) 2010 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter
	, utils = require('./utils')
	, auth = require('./auth')
	, http = require('http')
	, https = require('https')
	, url = require('url')
	, mime = require('mime')
	, fs = require('fs')
	, crypto = require('crypto')
	, xml2js = require('xml2js')
	, qs = require('querystring');

// The max for multi-object delete, bucket listings, etc.
var BUCKET_OPS_MAX = 1000;

/**
 * Register event listeners on a request object to convert standard http
 * request events into appropriate call backs.
 * @param {Request} req The http request
 * @param {Function} fn(err, res) The callback function.
 * err - The exception if an exception occurred while sending the http
 * request (for example if internet connection was lost).
 * res - The http response if no exception occurred.
 * @api private
 */
function registerReqListeners(req, fn){
	req.on('response', function(res){ fn(null, res); });
	req.on('error', fn);
}

function ensureLeadingSlash(filename) {
	return filename[0] !== '/' ? '/' + filename : filename;
}

function removeLeadingSlash(filename) {
	return filename[0] === '/' ? filename.substring(1) : filename;
}

function encodeSpecialCharacters(filename) {
	// Note: these characters are valid in URIs, but S3 does not like them for
	// some reason.
	return filename.replace(/[!'()*]/g, function (char) {
		return '%' + char.charCodeAt(0).toString(16);
	});
}

function getHeader(headers, headerNameLowerCase) {
	for (var header in headers) {
		if (header.toLowerCase() === headerNameLowerCase) {
			return headers[header];
		}
	}
	return null;
}

/**
 * Get headers needed for Client#copy and Client#copyTo.
 *
 * @param {String} sourceFilename
 * @param {Object} headers
 * @api private
 */

function getCopyHeaders(sourceBucket, sourceFilename, headers) {
	sourceFilename = ensureLeadingSlash(sourceFilename);
	headers = utils.merge({
		Expect: '100-continue'
	}, headers || {});
	headers['x-amz-copy-source'] = '/' + sourceBucket + sourceFilename;
	headers['Content-Length'] = 0; // to avoid Node's automatic chunking if omitted
	return headers;
}


var Base = function Base(options) {
	if (!options.key) throw new Error('aws "key" required');
	if (!options.secret) throw new Error('aws "secret" required');

	this.domain = options.domain ||
		((!options.region || options.region === 'us-standard') ?
			's3.amazonaws.com' :
			('s3-' + options.region + '.amazonaws.com'));
	this.server = options.server || this.domain;
	this.port = options.port;
	this.secure = 'secure' in options ? options.secure : !options.port || options.port == 443;
	this.host = this.domain;

};

var createWrapper = function(base, template, arguments) {
	var args = arguments, tmp = new Function();
	tmp.prototype = base;
	var Wrapper = function Wrapper() {
		template.constructor.apply(this, args);
	};
	Wrapper.prototype = new tmp();
	utils.merge(Wrapper.prototype, template);
	return new Wrapper();
}


var clientTemplate = {
	constructor : function(options) {
		console.log(options);
	},
	bucket : function (bucketID) {
		if (bucketID !== bucketID.toLowerCase()) {
			throw new Error('AWS bucket names must be all lower case. ' +
				'See https://github.com/LearnBoost/knox/issues/44#issuecomment-7074177 ' +
				'for details.');
		}
		return createWrapper(this, bucketTemplate, [bucketID]);
	}
};

/**
 * Initialize a `Client` with the given `options`.
 *
 * Required:
 *
 *  - `key`     amazon api key
 *  - `secret`  amazon secret
 *  - `bucket`  bucket name string, ex: "learnboost"
 *
 * @param {Object} options
 * @api public
 */

var Client = module.exports = exports = function Client(options) {
	var base = new Base(options);
	return createWrapper(base, clientTemplate, [options]);
};

var bucketTemplate = {
	constructor : function(id) {
		this.id = id;
		this.host = id + '.' + this.domain;
	},
	create : function () {

	},
	list : function () {

	}
};




var serviceTemplate = {
	list : function (cb) {

	}
};

var bucketTemplate = {
	get : function (cb) {},               // GET /
	head : function (cb) {},              // HEAD /
	delete : function (cb) {},            // DELETE /
	deleteCORS : function (cb) {},        // DELETE /?cors
	deleteLifecycle : function (cb) {},   // DELETE /?lifecycle
	deletePolicy : function (cb) {},      // DELETE /?policy
	deleteTagging : function (cb) {},     // DELETE /?tagging
	deleteWebsite : function (cb) {},     // DELETE /?website
	getACL : function (cb) {},            // GET /?acl
	getCORS : function (cb) {},           // GET /?cors
	getLifecycle : function (cb) {},      // GET /?lifecycle
	getLocation : function (cb) {},       // GET /?location
	getLogging : function (cb) {},        // GET /?logging
	getNotification : function (cb) {},   // GET /?notification
	getTagging : function (cb) {},        // GET /?tagging
	getVersions : function (cb) {},       // GET /?versions
	getRequestPayment : function (cb) {}, // GET ?requestPayment
	getVersioning : function (cb) {},     // GET /?versioning
	getWebsite : function (cb) {},        // GET /?website
	getUploads : function (cb) {},        // GET /?uploads
	put : function (cb) {},               // PUT /
	putACL : function (cb) {},            // PUT /?acl
	putCORS : function (cb) {},           // PUT /?cors
	putLifecycle : function (cb) {},      // PUT /?lifecycle
	putPolicy : function (cb) {},         // PUT /?policy
	putLogging : function (cb) {},        // PUT /?logging
	putNotification : function (cb) {},   // PUT /?notification
	putTagging : function (cb) {},        // PUT /?tagging
	putRequestPayment : function (cb) {}, // PUT ?requestPayment
	putVersioning : function (cb) {},     // PUT /?versioning
	putWebsite : function (cb) {}         // PUT /?website
};
bucketTemplate.create = bucketTemplate.put;
bucketTemplate.list = bucketTemplate.get;
bucketTemplate.exists = bucketTemplate.head;
bucketTemplate.listUploads = bucketTemplate.getUploads;


var bucketTemplate2 = {
	head:              [ 'HEAD',   '/',               [], [] ],
	get:               [ 'GET',    '/',               ['delimiter','marker','max-keys','prefix'], [] ],
	getACL:            [ 'GET',    '/?acl', [], [] ],
	getCORS:           [ 'GET',    '/?cors', [], [] ],
	getLifecycle:      [ 'GET',    '/?lifecycle', [], [] ],
	getLocation:       [ 'GET',    '/?location', [], [] ],
	getLogging:        [ 'GET',    '/?location', [], [] ],
	getNotification:   [ 'GET',    '/?notification', [], [] ],
	getTagging:        [ 'GET',    '/?tagging', [], [] ],
	getVersions:       [ 'GET',    '/?versions', [], [] ],
	getRequestPayment: [ 'GET',    '/?requestPayment', [], [] ],
	getVersioning:     [ 'GET',    '/?versioning', [], [] ],
	getWebsite:        [ 'GET',    '/?website', [], [] ],
	getUploads:        [ 'GET',    '/?uploads', [], [] ],
	put:               [ 'PUT',    '/', [], [] ],
	putACL:            [ 'PUT',    '/?acl',           [], ['x-amz-acl','x-amz-grant-read','x-amz-grant-write','x-amz-grant-read-acp','x-amz-grant-write-acp','x-amz-grant-full-control'] ],
	putCORS:           [ 'PUT',    '/?cors', [], [] ],
	putLifecycle:      [ 'PUT',    '/?lifecycle', [], [] ],
	putPolicy:         [ 'PUT',    '/?policy', [], [] ],
	putLogging:        [ 'PUT',    '/?logging', [], [] ],
	putNotification:   [ 'PUT',    '/?notification', [], [] ],
	putTagging:        [ 'PUT',    '/?tagging', [], [] ],
	putRequestPayment: [ 'PUT',    '/?requestPayment', [], [] ],
	putVersioning:     [ 'PUT',    '/?versioning', [], [] ],
	putWebsite:        [ 'PUT',    '/?website', [], [] ],
	delete:            [ 'DELETE', '/', [], [] ],
	deleteCORS:        [ 'DELETE', '/?cors', [], [] ],
	deleteLifecycle:   [ 'DELETE', '/?lifecycle', [], [] ],
	deletePolicy:      [ 'DELETE', '/?policy', [], [] ],
	deleteTagging:     [ 'DELETE', '/?tagging', [], [] ],
	deleteWebsite:     [ 'DELETE', '/?website', [], [] ]
};

function generateFunction(template) {
	var b = function b() {};
}


function listBucket(params, cb) {
	var host = this.bucket + '.' + this.host;

	var params = {
		'delimeter' : params.delimeter || '/',
		'marker' : params.marker || undefined,
	}
}


/*
Client.prototype.list = function (options, fn) {

};

Client.prototype.createBucket = function (options, fn) {
	this._get('/')
};

Bucket.prototype.create = function (options, fn) {
	this._put('/')
};

Client.prototype._request = function(method, filename, headers){
	var options = { host: this.server, agent: this.agent }
		, date = new Date;

	headers = headers || {};

	if (this.port)
		options.port = this.port;

	filename = encodeSpecialCharacters(ensureLeadingSlash(filename));

	// Default headers
	utils.merge(headers, {
		Date: date.toUTCString()
		, Host: this.host
	});

	if ('token' in this)
		headers['x-amz-security-token'] = this.token;

	// Authorization header
	headers.Authorization = auth.authorization({
		key: this.key
		, secret: this.secret
		, verb: method
		, date: date
		, resource: auth.canonicalizeResource('/' + this.bucket + filename)
		, contentType: getHeader(headers, 'content-type')
		, md5: getHeader(headers, 'content-md5') || ''
		, amazonHeaders: auth.canonicalizeHeaders(headers)
	});

	// Issue request
	options.method = method;
	options.path = filename;
	options.headers = headers;
	var req = (this.secure ? https : http).request(options);
	req.url = this.url(filename);

	return req;
};

*/



