const { isStrongPassword } = require('./password');

test('rejects a password shorter than 8 characters', () => {
  expect(isStrongPassword('Ab1!')).toBe(false);
});

test('rejects a password missing an uppercase letter', () => {
  expect(isStrongPassword('lowercase1!')).toBe(false);
});

test('rejects a password missing a number', () => {
  expect(isStrongPassword('Uppercase!')).toBe(false);
});

test('rejects a password missing a symbol', () => {
  expect(isStrongPassword('Uppercase1')).toBe(false);
});

test('accepts a password meeting every requirement', () => {
  expect(isStrongPassword('Strong1!Pass')).toBe(true);
});