import {
  htmlResponse,
  renderSignInMessage,
} from '@/lib/indieweb/indieauth-consent';
import {
  handleConsentDecision,
  handleConsentPage,
} from '@/lib/indieweb/indieauth-endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth-storage';

/**
 * The owner's consent page for IndieAuth sign-ins. GET shows the request and
 * POST approves or denies it. This is the one path the owner acts on, so it
 * is the one to put behind Cloudflare Access.
 */
export async function GET(request: Request) {
  try {
    const options = indieAuthEndpointOptions();
    if (!options.owner || !(await options.owner.verify(request)).ok)
      return denied();
    return await handleConsentPage(request, options);
  } catch (error) {
    console.error('IndieAuth consent page failed:', error);
    return failed();
  }
}

export async function POST(request: Request) {
  try {
    const options = indieAuthEndpointOptions();
    if (!options.owner || !(await options.owner.verify(request)).ok)
      return denied();
    return await handleConsentDecision(request, options);
  } catch (error) {
    console.error('IndieAuth consent failed:', error);
    return failed();
  }
}

function denied() {
  return htmlResponse(
    renderSignInMessage('Access denied', 'Sign in through Cloudflare Access.'),
    403
  );
}

function failed() {
  return htmlResponse(
    renderSignInMessage(
      'Sign-in failed',
      'Something went wrong on this site. Nothing was approved.'
    ),
    500
  );
}
