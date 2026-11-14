import { expect, it } from 'vitest';
import { FirebaseError } from 'firebase/app';
import { getAuthIssue } from '../src/utils/authErrors';
it.each(['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'])('recognizes credential errors without revealing whether an account exists: %s', code => {
  expect(getAuthIssue(new FirebaseError(code, 'raw backend message'))).toEqual({ code, message: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' });
});
it.each([
  ['auth/configuration-not-found', 'Authentication'], ['auth/invalid-api-key', 'API anahtarı'],
  ['auth/api-key-not-valid.-please-pass-a-valid-api-key.', 'API anahtarı'], ['auth/operation-not-allowed', 'E-posta/Şifre'],
  ['auth/user-disabled', 'devre dışı'], ['auth/unauthorized-domain', 'yetkili alanlarına'],
  ['auth/api-key-service-blocked', 'Identity Toolkit API'],
])('preserves the actionable configuration/error reason: %s', (code, expected) => {
  expect(getAuthIssue({ code, message: 'private details' })).toMatchObject({ code, message: expect.stringContaining(expected) });
});
it('retains unknown Firebase codes rather than hiding their diagnosis', () => {
  expect(getAuthIssue({ code: 'auth/some-new-server-error', message: 'private details' })).toMatchObject({ code: 'auth/some-new-server-error' });
  expect(JSON.stringify(getAuthIssue({ code: 'auth/some-new-server-error', message: 'private details' }))).not.toContain('private details');
});
it('does not display arbitrary request payloads or unrecognized error messages', () => {
  expect(getAuthIssue(new Error('password=private')).message).not.toContain('private');
  expect(getAuthIssue({ code: 'https://example.com?password=private' }).code).toBeUndefined();
});
