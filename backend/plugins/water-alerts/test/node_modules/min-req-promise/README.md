[![Build Status](https://travis-ci.org/benoitvidis/min-req-promise.svg?branch=master)](https://travis-ci.org/benoitvidis/min-req-promise)
[![codecov](https://codecov.io/gh/benoitvidis/min-req-promise/branch/master/graph/badge.svg)](https://codecov.io/gh/benoitvidis/min-req-promise)

# Minimal Request Promise

[`request`](https://www.npmjs.com/package/request) and [`request-promise`](https://www.npmjs.com/package/request-promise) are great, but I was looking for an some extra-light implementation.

## Usage

### client.<get|post|put|delete|head>(url, [options])

- `url` The full url to request
- `options` an [http.request options](https://nodejs.org/dist/latest-v8.x/docs/api/http.html#http_http_request_options_callback) object. Can be extended with a `body` attribute.

**response**: An `http.IncomingMessage` object, complemented with a `body` attribute containing the response body data;

```javascript
const client = require('min-req-promise');

return client.get('https://some/url')
  .then(response => {
    // response is an http.IncomingMessage
    // with an extra `body` member
    
    console.log(response.headers);
    console.log(response.body);
  });
```
#### Posting data

 `POST`|`PUT`,.. body can be injected in `options.body`:
 
```javascript
const client = require('min-req-promise');

return client.post('http://some/url', {
  headers: {
    'Content-type': 'application/x-www-form-urlencoded'
  },
  body: 'foo=bar'
})
  .then(response => {
    console.log(response);
  });
```
