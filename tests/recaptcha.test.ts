import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyRecaptchaV3 } from '../src/lib/recaptcha';

test('reCAPTCHA is optional when no secret key is configured', async () => {
  const result = await verifyRecaptchaV3({
    token: undefined,
    expectedAction: 'signup',
    secretKey: '',
  });

  assert.deepEqual(result, { success: true, skipped: true });
});

test('reCAPTCHA requires a token when configured', async () => {
  const result = await verifyRecaptchaV3({
    token: undefined,
    expectedAction: 'signup',
    secretKey: 'test-secret',
  });

  assert.deepEqual(result, { success: false, reason: 'missing_token' });
});

test('reCAPTCHA sends the token and IP to Google and accepts a matching action', async () => {
  let submittedBody = '';
  const result = await verifyRecaptchaV3({
    token: 'test-token',
    remoteIp: '203.0.113.10',
    expectedAction: 'signup',
    secretKey: 'test-secret',
    fetchImpl: async (_input, init) => {
      submittedBody = init?.body?.toString() || '';
      return new Response(JSON.stringify({
        success: true,
        score: 0.9,
        action: 'signup',
      }));
    },
  });

  assert.equal(result.success, true);
  assert.equal(submittedBody, 'secret=test-secret&response=test-token&remoteip=203.0.113.10');
});

test('reCAPTCHA rejects low scores and tokens issued for another action', async () => {
  const lowScore = await verifyRecaptchaV3({
    token: 'low-score-token',
    expectedAction: 'signup',
    secretKey: 'test-secret',
    fetchImpl: async () => new Response(JSON.stringify({
      success: true,
      score: 0.2,
      action: 'signup',
    })),
  });
  assert.equal(lowScore.success, false);
  if (!lowScore.success) assert.equal(lowScore.reason, 'low_score');

  const wrongAction = await verifyRecaptchaV3({
    token: 'wrong-action-token',
    expectedAction: 'signup',
    secretKey: 'test-secret',
    fetchImpl: async () => new Response(JSON.stringify({
      success: true,
      score: 0.9,
      action: 'submit',
    })),
  });
  assert.equal(wrongAction.success, false);
  if (!wrongAction.success) assert.equal(wrongAction.reason, 'action_mismatch');
});

test('reCAPTCHA fails closed when verification is unavailable', async () => {
  const result = await verifyRecaptchaV3({
    token: 'test-token',
    expectedAction: 'signup',
    secretKey: 'test-secret',
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });

  assert.deepEqual(result, { success: false, reason: 'service_unavailable' });
});
