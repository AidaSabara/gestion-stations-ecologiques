/*
 * Copyright © 2018 Benoît Vidis <contact@benoitvidis.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const http = require('http');
const https = require('https');
const URL = require('url');

const client = (url) => /^https/.test(url) ? https : http;

module.exports.request = (url, method, options = {}) => new Promise((resolve, reject) => {
  const u = URL.parse(url);

  const req = client(url).request(Object.assign({}, options, {
    method,
    hostname: u.hostname,
    port: u.port,
    path: u.path,
  }), res => {
    let buffer = new Buffer.alloc(0);

    res.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
    });
    res.on('end',() => {
      if (options.responseEncoding
        || !res.headers['content-type']
        || /^(text|application\/json)/.test(res.headers['content-type'])
      ) {
        let charset = 'utf-8';

        if (options.responseEncoding) {
          charset = options.responseEncoding;
        }
        else if (res.headers['content-type']) {
          const match = /;\s*charset=(.*)/.exec(res.headers['content-type']);
          if (match) {
            charset = match[1];
          }
        }

        charset = charset.toLowerCase()
          .replace(/^iso-?8859(-1)?$/, 'latin1');

        if ([
            'ascii',
            'base64',
            'binary',
            'hex',
            'ucs2',
            'ucs-2',
            'utf16le',
            'utf-16le',
            'utf8',
            'utf-8',
            'latin1'
          ].indexOf(charset) < 0) {
          // unsupported charset, fallback to utf-8
          charset = 'utf-8';
        }

        res.body = buffer.toString(charset);
      }
      else {
        // assume binary content
        res.body = buffer;
      }

      resolve(res);
    });

    res.on('error', reject);

    res.on('timeout', () => reject(req));
  });

  req.on('error', reject);
  req.write(options.body || '');
  req.end();
});

for (const method of ['get', 'post', 'delete', 'put', 'head']) {
  module.exports[method] = (url, options) => module.exports.request(url, method, options);
}