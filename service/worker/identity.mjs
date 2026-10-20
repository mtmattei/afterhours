import {createRemoteJWKSet, jwtVerify} from 'jose';

const keys = new Map();
export async function verifyIdentity(token, projectUrl, resolver) {
  const url = new URL(projectUrl);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password)
    throw Error('Account service is not configured correctly.');
  const issuer = url.origin + '/auth/v1';
  if (!resolver) {
    if (!keys.has(issuer)) keys.set(issuer, createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json')));
    resolver = keys.get(issuer);
  }
  const {payload} = await jwtVerify(token, resolver, {
    issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'],
    requiredClaims: ['sub', 'exp', 'iat', 'role', 'is_anonymous'], clockTolerance: 5
  });
  if (!/^[0-9a-f-]{36}$/i.test(payload.sub) || payload.role !== 'authenticated' ||
      typeof payload.is_anonymous !== 'boolean') throw Error('Invalid player identity.');
  return {id: payload.sub, anonymous: payload.is_anonymous};
}
