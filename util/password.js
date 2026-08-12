// util/password.js
// One shared rule, used everywhere a password is set or changed: at least
// 8 characters, one uppercase letter, one number, and one symbol.
function isStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasNumber && hasSymbol;
}

const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.';

module.exports = { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE };
