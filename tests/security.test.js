const assert = require('node:assert');
const test = require('node:test');

require('../utils/security.js');
const { toSafeString, DEFAULT_LIMITS } = globalThis.MangaSecurity;

test('toSafeString tests', async (t) => {
  await t.test('handles null and undefined', () => {
    assert.strictEqual(toSafeString(null), '');
    assert.strictEqual(toSafeString(undefined), '');
  });

  await t.test('coerces non-string values', () => {
    assert.strictEqual(toSafeString(123), '123');
    assert.strictEqual(toSafeString(true), 'true');
    assert.strictEqual(toSafeString(false), 'false');
    assert.strictEqual(toSafeString({}), '[object Object]');
    assert.strictEqual(toSafeString([]), '');
    assert.strictEqual(toSafeString([1, 2, 3]), '1,2,3');
  });

  await t.test('removes control characters', () => {
    // Should remove \u0000-\u0008, \u000b, \u000c, \u000e-\u001f, \u007f
    assert.strictEqual(toSafeString('hello\u0000world'), 'helloworld');
    assert.strictEqual(toSafeString('hello\u0007world'), 'helloworld');
    assert.strictEqual(toSafeString('hello\u0008world'), 'helloworld');
    assert.strictEqual(toSafeString('hello\u000bworld'), 'helloworld');
    assert.strictEqual(toSafeString('hello\u000cworld'), 'helloworld');
    assert.strictEqual(toSafeString('hello\u001bworld'), 'helloworld');
    assert.strictEqual(toSafeString('hello\u007fworld'), 'helloworld');

    // Should keep \n (0x0a), \r (0x0d) as they are safe whitespace
    // However, .trim() will remove them if they are at the edges, so we test them inside
    assert.strictEqual(toSafeString('hello\nworld'), 'hello\nworld');
    assert.strictEqual(toSafeString('hello\rworld'), 'hello\rworld');
  });

  await t.test('trims whitespace', () => {
    assert.strictEqual(toSafeString('  hello world  '), 'hello world');
    assert.strictEqual(toSafeString('\n\thello world\n\r'), 'hello world');
  });

  await t.test('truncates strings to maxLength', () => {
    const longString = 'a'.repeat(DEFAULT_LIMITS.string + 100);
    assert.strictEqual(toSafeString(longString).length, DEFAULT_LIMITS.string);
    assert.strictEqual(toSafeString('hello world', 5), 'hello');
  });
});
