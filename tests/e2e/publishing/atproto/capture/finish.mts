import type { RunContext } from './types.mts';

export async function finishCapture(runState: RunContext): Promise<void> {
  const notificationClean = await cleanupNotifications();
  const lifecycleClean = await cleanupLifecycles(notificationClean);
  const sourceClean = await cleanupSource(lifecycleClean);
  const finalNotificationClean = await checkFinalNotification(
    notificationClean,
    lifecycleClean,
    sourceClean
  );
  await cleanupFixture(lifecycleClean, sourceClean, finalNotificationClean);
  async function cleanupNotifications(): Promise<boolean> {
    let notificationClean = true;
    if (runState.notificationCleanup) {
      try {
        await runState.notificationCleanup();
      } catch {
        notificationClean = false;
        process.exitCode = 1;
        console.error(
          `Notification workflow cleanup remains pending. Preserve the fixture and use the private recovery directory ${runState.recoveryPath}.`
        );
      }
    }

    return notificationClean;
  }
  async function cleanupLifecycles(
    notificationClean: boolean
  ): Promise<boolean> {
    let lifecycleClean = notificationClean;
    if (runState.lifecycleCleanup && notificationClean) {
      try {
        await runState.lifecycleCleanup();
      } catch {
        lifecycleClean = false;
        console.error(
          `Lifecycle PDS cleanup remains pending. Its private receipts are in ${runState.recoveryPath}.`
        );
        process.exitCode = 1;
      }
    }

    return lifecycleClean;
  }
  async function cleanupSource(lifecycleClean: boolean): Promise<boolean> {
    let sourceClean = true;
    if (
      runState.sourceCleanup &&
      lifecycleClean &&
      runState.browserCleanupSucceeded &&
      (runState.publicationCleanupVerified || runState.fixtureCleanup)
    ) {
      try {
        await runState.sourceCleanup();
        console.log(
          'The unchanged owned source is removed, and the clean acceptance deployment returns 404.'
        );
      } catch {
        sourceClean = false;
        process.exitCode = 1;
        console.error(
          `Owned source/deployment cleanup remains pending in ${runState.recoveryPath}.`
        );
      }
    } else if (runState.sourceCleanup) sourceClean = false;

    return sourceClean;
  }
  async function checkFinalNotification(
    notificationClean: boolean,
    lifecycleClean: boolean,
    sourceClean: boolean
  ): Promise<boolean> {
    let finalNotificationClean = notificationClean;
    if (
      runState.fixtureCleanup &&
      lifecycleClean &&
      sourceClean &&
      runState.browserCleanupSucceeded &&
      runState.finalNotification
    ) {
      try {
        await runState.finalNotification();
      } catch {
        process.exitCode = 1;
        try {
          await runState.notificationCleanup!();
        } catch {
          finalNotificationClean = false;
        }
        console.error(
          `The final notification check did not pass. Its private run/drain journal is in ${runState.recoveryPath}.`
        );
      }
    }

    return finalNotificationClean;
  }
  async function cleanupFixture(
    lifecycleClean: boolean,
    sourceClean: boolean,
    finalNotificationClean: boolean
  ): Promise<void> {
    if (
      runState.fixtureCleanup &&
      lifecycleClean &&
      sourceClean &&
      runState.browserCleanupSucceeded &&
      finalNotificationClean
    ) {
      try {
        await runState.fixtureCleanup();
        runState.publicationCleanupVerified = true;
        console.log(
          'Final notification handlers are drained. The owned document is absent, and the publication is removed or restored. Foreign records remain unchanged.'
        );
      } catch {
        process.exitCode = 1;
        console.error(
          `Final PDS cleanup remains pending in ${runState.recoveryPath}.`
        );
      }
    }
  }
}
