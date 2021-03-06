var _ = require('lodash');
var url = require('url');
var request = require('request');

module.exports = {
  body : function(options) {
    return _.map(options, this._buildNode.bind(this)).join('');
  },
    
  soapHeader : function(options) {
    return _.map(options, this._buildNode.bind(this)).join('');
  },    

  envelope : function(options) {
    if (! options.additionalNamespaces) {
      options.additionalNamespaces = [];
    }

    return '<?xml version="1.0" encoding="utf-8"?>\n' +
           '<soap:Envelope ' +
           'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
           'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
           'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ' +
            options.additionalNamespaces.join(' ') +
           '>\n' +
              '<soap:Header>' + options.soapHeader + '</soap:Header>' +
              '<soap:Body>' + options.body + '</soap:Body>' +
           '</soap:Envelope>';
  },

  up : function(options, cb) { // send the request
    if (! options.headers) {
      options.headers = {};
    }

    var soapBody = this.body(options.body);
    var soapHeader = this.soapHeader(options.soapHeader);
    var envelope = this.envelope({
      body : soapBody,
      additionalNamespaces : options.additionalNamespaces,
      soapHeader: soapHeader    
    });

    options.headers['Content-Length'] = this.contentLength(envelope);
    options.headers['Content-Type'] = 'text/xml; charset=utf-8';
    options.uri = url.parse(options.url);

    var req = request(_.omit(options, [ 'body', 'url' ]), function(error, res, resBody) {
      if (error) {
        cb(error);
      }

      if (res.statusCode !== 200) {
        cb(new Error('Failed request with response code: ' + res.statusCode), res);
      }

      if (_.isString(resBody)) {
        // Remove any extra characters that appear before or after the SOAP envelope.
        var match = resBody
          .match(/(?:<\?[^?]*\?>[\s]*)?<([^:]*):Envelope([\S\s]*)<\/\1:Envelope>/i);

        if (match) {
          resBody = match[0];
        }
      }

      cb(null, res, resBody);
    });

    req.end(envelope);
    return req;
  },

  contentLength : function(content) {
    return Buffer.byteLength(content, 'utf8');
  },

  basicAuth : function(username, password) {
    return 'Basic ' + new Buffer((username + ':' + password)).toString('base64');
  },

  _buildNode : function(node, key) {
    var attributes = this._getAttributes(node);
    var value;

    if (this._isAttributes(key) || this._isValue(key)) {
      return '';
    } else if (_.isArray(node)) {
      value = _.map(node, this.body.bind(this)).join(''); // if its an array, map over each node
    } else if (_.isObject(node)) {
      value = this.body(node); // recursively map over it and go deeper like Inception
    } else if (_.isString(node)) {
      value = node; // node is the value
    }

    if (node.value) {
      value = node.value; // value couldn't be just a string for some reason, so be explicit w/ key
    }

    return '<' + key + this._includeAttributes(attributes) + '>' + value + '</' + key + '>';
  },

  _getAttributes : function(node) {
    if (! node.attributes) {
      return [];
    }

    return _.map(node.attributes, this._getAttributeKeyValuePair.bind(this));
  },

  _getAttributeKeyValuePair : function(attribute) {
    // return attribute key/value pair to place it inside the node
    return _.keys(attribute).pop() + '=' + '"' + _.values(attribute).pop() + '"';
  },

  _includeAttributes : function(attributes) {
    if (! attributes.length) { // if attributes exist on a node, include them otherwise return
      return '';
    }

    return ' ' + attributes.join(' ');
  },

  _isValue : function(key) {
    return key === 'value';
  },

  _isAttributes : function(key) {
    return key === 'attributes'; // check if the key name is 'attributes'
  },
};
