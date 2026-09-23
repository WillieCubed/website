#!/usr/bin/env node
/**
 * Make a new TOTP secret for the IndieAuth consent page.
 *
 *   pnpm indieauth:totp
 *
 * Prints a fresh secret and the otpauth:// URI for it. Add the URI to an
 * authenticator app (paste it, or turn it into a QR code locally), then set
 * the secret as INDIEAUTH_TOTP_SECRET in the deployment's environment. The
 * secret is shown once and never written to disk; running the script again
 * makes a different one, and setting that replaces the old one.
 */
import {
  generateTotpSecret,
  totpProvisioningUri,
} from '../lib/indieweb/indieauth-owner';
import { site } from '../lib/site';

const secret = generateTotpSecret();
const account = new URL(site.origin).hostname;

console.log(`INDIEAUTH_TOTP_SECRET=${secret}`);
console.log('');
console.log(totpProvisioningUri(secret, `${site.name} IndieAuth`, account));
