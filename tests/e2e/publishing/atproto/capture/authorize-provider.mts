import type {} from '@atcute/atproto';
import assert from 'node:assert/strict';

interface Context {
  first: import('@playwright/test').BrowserContext;
  ownedIdentities:
    | import('../../../../support/publishing/identities/run.mts').AcceptanceIdentities
    | undefined;
  OWNER: string;
  ORIGIN: string;
}

export async function authorizeOwnedProvider(
  dependencies: Context,
  page: Awaited<ReturnType<typeof dependencies.first.newPage>>,
  identity: NonNullable<typeof dependencies.ownedIdentities>['publisher'],
  providerOrigin: string,
  expectation: 'grant' | 'cancel' | 'expired'
) {
  assert(identity.did !== dependencies.OWNER && identity.password);
  const deadline = Date.now() + 120000;
  let submittedCredentials = false;
  while (Date.now() < deadline) {
    if (new URL(page.url()).origin === dependencies.ORIGIN) return;
    await page.waitForFunction(
      `((siteOrigin) => {
          if (location.origin === siteOrigin) return true;
          return [...document.querySelectorAll('input[type="password"]')].some(
            (element) => element.getClientRects().length > 0
          ) || [...document.querySelectorAll('button')].some(
            (button) => button.getClientRects().length > 0 &&
              /^(?:authorize|accept|allow access|deny access|cancel|sign in as .+)$/i.test(
                button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''
              )
          );
        })(${JSON.stringify(dependencies.ORIGIN)})`,
      undefined,
      { timeout: Math.max(1, deadline - Date.now()) }
    );
    if (new URL(page.url()).origin === dependencies.ORIGIN) return;
    assert.equal(new URL(page.url()).origin, providerOrigin);
    const deny = page.getByRole('button', {
      name: /^(?:Deny access|Cancel)$/i,
    });
    if (
      expectation === 'cancel' &&
      (await deny.count()) === 1 &&
      (await deny.isVisible())
    ) {
      await deny.click();
      return;
    }
    const password = page.locator('input[type="password"]');
    if (await password.isVisible()) {
      assert(
        !submittedCredentials,
        'The owned provider did not accept its generated credentials.'
      );
      const identifier = page.locator(
        'input[name="username"], input[name="identifier"]'
      );
      assert.equal(await identifier.count(), 1);
      if ((await identifier.getAttribute('readonly')) !== null)
        assert(
          [identity.handle, identity.did, identity.email].includes(
            await identifier.inputValue()
          )
        );
      else await identifier.fill(identity.handle);
      assert.equal(new URL(page.url()).origin, providerOrigin);
      await password.fill(identity.password);
      await page.getByRole('button', { name: /^Sign in$/i }).click();
      submittedCredentials = true;
      await password.waitFor({ state: 'hidden', timeout: 60000 });
      continue;
    }
    const account = page.getByRole('button', {
      name: `Sign in as ${identity.handle}`,
      exact: true,
    });
    if (await account.isVisible()) {
      await account.click();
      continue;
    }
    const approve = page.getByRole('button', {
      name: /^(?:Authorize|Accept|Allow access)$/i,
    });
    if (
      expectation !== 'cancel' &&
      (await approve.count()) === 1 &&
      (await approve.isVisible())
    ) {
      assert.equal(new URL(page.url()).origin, providerOrigin);
      const consentText = await page.locator('body').innerText();
      assert(
        consentText.includes(identity.handle) ||
          consentText.includes(identity.did),
        'The provider consent page must identify the journaled account.'
      );
      await approve.click();
      return;
    }
    throw new Error(
      'The owned official provider needs an unsupported interactive step. No grant was synthesized.'
    );
  }
  throw new Error(
    'The owned provider authorization UI did not complete before its deadline.'
  );
}
