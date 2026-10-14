import {
  htmlResponse,
  renderSignInMessage,
} from '@/lib/indieweb/indieauth/consent';
import {
  handleConsentDecision,
  handleConsentPage,
} from '@/lib/indieweb/indieauth/endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth/storage';

/**
 * Validate the authorization request and render the owner consent form,
 * including the requesting client and scopes.
 */
export async function GET(request: Request) {
  try {
    return await handleConsentPage(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth consent page failed:', error);
    return failed();
  }
}

/**
 * Approve or deny the authorization request from a same-origin consent form.
 * Approval requires owner authentication and returns an authorization code
 * for the selected scopes; denial redirects with an OAuth error.
 */
export async function POST(request: Request) {
  try {
    return await handleConsentDecision(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth consent failed:', error);
    return failed();
  }
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
