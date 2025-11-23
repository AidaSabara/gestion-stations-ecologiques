const
  client = require('../src/index'),
  http = require('http'),
  should = require('should');

describe('index.js', () => {
  const server = http.createServer((request, response) => {
    let buffer = Buffer.alloc(0);

    request.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
    });

    request.on('end', () => {
      for (const header of Object.keys(request.headers)) {
        response.setHeader(header, request.headers[header]);
      }

      response.end(JSON.stringify({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: buffer.toString()
      }));
    });

  });

  before((done) => {
    server.listen(9999, 'localhost', done);
  });

  after(() => {
    server.close();
  });

  it('get', () => client.get('http://localhost:9999/test/path?q=query&s=string')
    .then(response => {
      const json = JSON.parse(response.body);

      should(json.method).eql('GET');
      should(json.headers.host).eql('localhost:9999');
      should(json.url).eql('/test/path?q=query&s=string');
    }));

  it('post', () => client.post('http://localhost:9999', {body: 'foo=bar'})
    .then(response => {
      const json = JSON.parse(response.body);

      should(json.method).eql('POST');
      should(json.body).eql('foo=bar');
    }));

  it('delete', () => client.delete('http://localhost:9999/path')
    .then(response => {
      const json = JSON.parse(response.body);

      should(json.method).eql('DELETE');
      should(json.url).eql('/path');
    }));

  it('binary content', () => client.post('http://localhost:9999/binary', {
    headers: {'Content-type': 'image/png'},
    body: Buffer.from('image')
  })
    .then(response => {
      should(response.body).be.an.instanceOf(Buffer);
      should(JSON.parse(response.body).body).eql('image');
    }));

  it('response encoding', () => client.put('http://localhost:9999/encoding', {
    headers: {'Content-type': 'text/html; charset=ISO8859-1'},
    body: 'élégiaque'
  })
    .then(response => {
      const json = JSON.parse(response.body);
      should(json.body).eql('Ã©lÃ©giaque');
    }));

  it('unsupported charset falls back to utf-8', () => client.put('http://localhost:9999/unsupported/encoding', {
    headers: {'Content-type': 'text/html; charset=somethingInvalid'},
    body: 'élégiaque'
  })
    .then(response => {
      const json = JSON.parse(response.body);
      should(json.body).eql('élégiaque');
    }));

  it('forced response encoding', () => client.put('http://localhost:9999/forced', {
    responseEncoding: 'utf-8',
    headers: {'Content-type': 'binary/stream'},
    body: Buffer.from('content')
  })
    .then(response => {
      should(typeof response.body).eql('string');
    }));

  it('request exception', () => client.get('http://foobar:7777/')
    .catch(err => should(err).be.instanceof(Error).and.match({message: 'getaddrinfo ENOTFOUND foobar foobar:7777'})));
});