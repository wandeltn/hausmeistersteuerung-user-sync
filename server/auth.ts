import * as OIDC from 'openid-client';
import express from 'express';

const router = express.Router();

let getCurrentURL = function (req: express.Request) {
  return (req.protocol + '://' + req.get('host') + req.originalUrl);
};


let oidcClient: any = null;
const issuerUrl = process.env.OIDC_ISSUER;
const clientId = process.env.OIDC_CLIENT_ID;
const clientSecret = process.env.OIDC_CLIENT_SECRET;
const redirectUri = process.env.OIDC_REDIRECT_URI || 'http://localhost:5000/auth/callback';

if (!issuerUrl || !clientId) {
  throw new Error('OIDC_ISSUER and OIDC_CLIENT_ID must be set');
}

// Discover and prepare the configuration used by the helper APIs
const serverUrl = new URL(process.env.SERVER_URL as string);
const config = await OIDC.discovery(serverUrl, clientId, clientSecret);
const generatorsAny: any = (OIDC as any);

let code_challenge_method = 'S256';

// per-session OIDC values will be stored on req.session.oidc
let sub: string;
let access_token: string;

// Fallback in-memory store for PKCE/state/nonce when session cookie is not present
// Only enabled in development to assist debugging when cookies are lost
const oidcTempStore = process.env.NODE_ENV === 'development' ? new Map<string, { code_verifier: string; nonce: string; created: number }>() : null as any;
const OIDC_TEMP_TTL_MS = 5 * 60 * 1000; // 5 minutes

if (process.env.NODE_ENV === 'development') {
  // Periodic cleanup to avoid memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of (oidcTempStore as Map<string, any>).entries()) {
      if (now - v.created > OIDC_TEMP_TTL_MS) (oidcTempStore as Map<string, any>).delete(k);
    }
  }, 60 * 1000).unref();
}


// start login
router.get('/login', async (req, res, next) => {
  try {
    // generate per-request PKCE and nonce and optionally state (see provider capabilities)
    const code_verifier = (generatorsAny.codeVerifier ? generatorsAny.codeVerifier() : (OIDC as any).randomPKCECodeVerifier());
    const code_challenge = (generatorsAny.codeChallenge ? await generatorsAny.codeChallenge(code_verifier) : await (OIDC as any).calculatePKCECodeChallenge(code_verifier));
    const nonce = (generatorsAny.nonce ? generatorsAny.nonce() : (OIDC as any).randomNonce());

    // Determine whether the provider expects PKCE without state. Per openid-client docs,
    // if the server supports PKCE we should NOT send state. Use config.serverMetadata() to check.
    let providerSupportsPKCE = true;
    try {
      providerSupportsPKCE = !!(config && (config.serverMetadata && config.serverMetadata().supportsPKCE && config.serverMetadata().supportsPKCE()));
    } catch (e) {
      // fallback to true
      providerSupportsPKCE = true;
    }

    const state = providerSupportsPKCE ? undefined : (generatorsAny.state ? generatorsAny.state() : (OIDC as any).randomState ? (OIDC as any).randomState() : (OIDC as any).randomNonce());

    // regenerate session to ensure we have a fresh session id
    if (!req.session) req.session = {} as any;
    req.session.regenerate((err: any) => {
      if (err) {
        console.error('Session regenerate error:', err);
        return next(err);
      }

      // store only the values we need
      req.session.oidc = { code_verifier, nonce } as any;
      if (state) (req.session.oidc as any).state = state;
      // store in fallback map as well (short-lived) only if we have a state
      try {
        if (process.env.NODE_ENV === 'development' && state) (oidcTempStore as Map<string, any>).set(state, { code_verifier, nonce, created: Date.now() });
      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.warn('Failed to set fallback OIDC temp store:', e);
      }
      console.log('Saved OIDC session values for sessionID=', (req as any).sessionID || req.session.id);

        const parameters: Record<string, string> = {
          redirect_uri: redirectUri,
          scope: 'openid email',
          code_challenge,
          code_challenge_method,
          nonce,
        };
        if (state) (parameters as any).state = state;
        const redirectTo = OIDC.buildAuthorizationUrl(config, parameters as any);
      console.log('Redirecting to OIDC provider with URL:', redirectTo.href);

      // persist session data to store before redirecting so callback can read it
      req.session.save((err2: any) => {
        if (err2) {
          console.error('Failed to save session before redirect:', err2);
          return next(err2);
        }
        console.log('Session saved for redirect, sessionID=', (req as any).sessionID || req.session.id);
        if (process.env.NODE_ENV === 'development') {
          try {
            const setCookie = (res.getHeader && res.getHeader('Set-Cookie')) || undefined;
            console.log('Set-Cookie header on redirect response:', setCookie);
          } catch (e) {
            console.warn('Could not read Set-Cookie header for debug:', e);
          }
        }
        res.redirect(redirectTo.href);
      });
    });
  } catch (err) {
    next(err);
  }
});

// callback
router.get('/callback', async (req, res, next) => {
  try {
  console.log('Received callback with query:', req.query);
  console.log('Callback sessionID=', (req as any).sessionID || req.session?.id);
  console.log('Callback request host:', req.get('host'));
  console.log('Callback request Cookie header:', req.headers.cookie);
    let currentUrl = getCurrentURL(req);
    console.log('Awaiting token exchange for URL:', currentUrl);

  let sessionOidc = req.session?.oidc as any;
    if (!sessionOidc) {
      // try fallback store by state
      const returnedState = (req.query && (req.query as any).state) || '';
      if (returnedState) {
        const fallback = oidcTempStore.get(returnedState);
        if (fallback) {
          console.warn('Using fallback OIDC temp store for state=', returnedState);
          sessionOidc = { code_verifier: fallback.code_verifier, nonce: fallback.nonce, state: returnedState } as any;
          oidcTempStore.delete(returnedState);
        }
      }
    }
    if (!sessionOidc) {
      throw new Error('Missing OIDC session data in callback');
    }

    const returnedState = (req.query && (req.query as any).state) || '';
    if ((sessionOidc as any).state) {
      if (returnedState !== (sessionOidc as any).state) {
        console.warn('OIDC state mismatch: returned=', returnedState, ' expected=', (sessionOidc as any).state);
        // abort early to avoid token exchange with mismatched state
        throw new Error('OIDC state mismatch');
      }
    }

    // use client.callback; extract params via client.callbackParams(req)
    let tokens: any;
    try {
      // Use the helper authorizationCodeGrant which accepts the discovery/config
      try {
        // If we did not send 'state' originally, some providers may still return
        // an empty or unexpected state parameter. Remove it from the URL before
        // handing it to the library so it doesn't treat it as an unexpected param.
        let exchangeUrl = new URL(currentUrl);
        const returnedStateRaw = exchangeUrl.searchParams.get('state');
        if (!(sessionOidc as any).state) {
          // delete state entirely
          exchangeUrl.searchParams.delete('state');
        } else if (returnedStateRaw === '') {
          // empty state — strip it to avoid unexpected state error
          exchangeUrl.searchParams.delete('state');
        }

        tokens = await OIDC.authorizationCodeGrant(config, exchangeUrl, {
          pkceCodeVerifier: sessionOidc.code_verifier,
          expectedNonce: sessionOidc.nonce,
          idTokenExpected: true,
        } as any);
        console.log('Token Endpoint Response:', tokens);
        ({ access_token } = tokens);
      } catch (exchangeErr: any) {
        try {
          const util = await import('node:util');
          console.error('Token exchange failed:', exchangeErr && exchangeErr.message ? exchangeErr.message : exchangeErr);
          console.error('Full exchange error:', util.inspect(exchangeErr, { depth: 6 }));
          if (exchangeErr?.response) {
            try {
              console.error('Provider response object:', util.inspect(exchangeErr.response, { depth: 6 }));
            } catch (e) {
              console.error('Failed to inspect provider response object:', e);
            }
          }
        } catch (logErr) {
          console.error('Error while logging exchange error:', logErr, exchangeErr);
        }
        throw exchangeErr;
      }
    } catch (exchangeErr: any) {
      console.error('Token exchange failed:', exchangeErr && exchangeErr.message ? exchangeErr.message : exchangeErr);
      if (exchangeErr?.response) {
        try {
          console.error('Provider response body:', exchangeErr.response.body || exchangeErr.response);
        } catch (e) {
          // ignore
        }
      }
      throw exchangeErr;
    }
    console.log('Access Token:', access_token);
    let claims = tokens.claims();
    console.log('ID Token Claims:', claims);
    if (!claims || !claims.sub) {
      throw new Error('ID token claims missing "sub"');
    }
    sub = claims.sub;
    // persist user in session and clean up OIDC temp values
    const name = typeof claims.name === 'string' ? claims.name : (typeof claims.preferred_username === 'string' ? claims.preferred_username : (typeof claims.email === 'string' ? claims.email : undefined));
    const email = typeof claims.email === 'string' ? claims.email : undefined;

    req.session!.user = {
      id: String(sub),
      name,
      email,
    };
    delete req.session!.oidc;

    // regenerate session to prevent fixation — here we just save and redirect
    req.session!.save(() => {
      res.redirect('/');
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res) => {
  req.session!.destroy((err) => {
    if (err) console.error('Error destroying session:', err);
    res.json({ ok: true });
  });
});

export default router;

// Dev-only helper to inspect session contents
if (process.env.NODE_ENV === 'development') {
  router.get('/debug-session', (req, res) => {
    res.json({ session: req.session, cookie: req.headers.cookie });
  });
}
