require('../utils/security.js');

describe('normalizeUrl', () => {
  const normalizeUrl = globalThis.MangaSecurity.normalizeUrl;

  it('should handle undefined or null values', () => {
    expect(normalizeUrl()).toBe('');
    expect(normalizeUrl(null)).toBe('');
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl(undefined)).toBe('');
  });

  it('should return valid absolute HTTP/HTTPS URLs', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
    expect(normalizeUrl('http://test.org/path')).toBe('http://test.org/path');
  });

  it('should handle protocol-relative URLs', () => {
    // Uses https by default if no baseUrl
    expect(normalizeUrl('//example.com/img.jpg')).toBe('https://example.com/img.jpg');

    // Uses baseUrl protocol if provided
    expect(normalizeUrl('//example.com/img.jpg', { baseUrl: 'http://base.com' }))
      .toBe('http://example.com/img.jpg');
  });

  it('should handle relative URLs with a baseUrl', () => {
    expect(normalizeUrl('/path/img.png', { baseUrl: 'https://example.com' }))
      .toBe('https://example.com/path/img.png');

    expect(normalizeUrl('img.png', { baseUrl: 'https://example.com/folder/' }))
      .toBe('https://example.com/folder/img.png');
  });

  it('should return empty string for invalid URLs', () => {
    expect(normalizeUrl('not a url')).toBe('');
    expect(normalizeUrl('javascript:alert(1)')).toBe('');
    expect(normalizeUrl('ftp://example.com')).toBe(''); // ftp is not allowed by default
  });

  it('should respect allowHttp option', () => {
    expect(normalizeUrl('https://example.com', { allowHttp: false })).toBe('');
    expect(normalizeUrl('http://example.com', { allowHttp: false })).toBe('');
  });

  it('should respect allowBlob option', () => {
    const blobUrl = 'blob:https://example.com/1234-5678';
    expect(normalizeUrl(blobUrl)).toBe(''); // default false
    expect(normalizeUrl(blobUrl, { allowBlob: true })).toBe(blobUrl);
  });

  it('should respect allowProtocolRelative option', () => {
    // When allowProtocolRelative is false, raw url starting with `//` will not have a protocol prepended
    // So new URL('//example.com') without baseUrl will throw an error since it lacks a scheme, causing catch block to return ''
    expect(normalizeUrl('//example.com', { allowProtocolRelative: false })).toBe('');

    // Note: if there's a baseUrl, it would parse against baseUrl.
    // e.g. new URL('//example.com', 'http://base.com') parses successfully as 'http://example.com/'
    // Let's verify the `if (allowProtocolRelative && raw.startsWith('//'))` logic by providing a different base protocol
    // With it true:
    expect(normalizeUrl('//example.com', { allowProtocolRelative: true, baseUrl: 'http://base.com' })).toBe('http://example.com/');
    // With it false: it relies on new URL('//example.com', 'http://base.com') which results in http://example.com/
    expect(normalizeUrl('//example.com', { allowProtocolRelative: false, baseUrl: 'http://base.com' })).toBe('http://example.com/');
  });

  it('should strip query and hash when stripQuery is true', () => {
    const url = 'https://example.com/path?query=123#hash';
    expect(normalizeUrl(url)).toBe(url); // default false
    expect(normalizeUrl(url, { stripQuery: true })).toBe('https://example.com/path');
  });

});
