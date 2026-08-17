import { Worker, type Job } from "bullmq";
import {
  getDMQueue,
  getRedisConnection,
  POSTBACK_JOB_NAME,
  type DmQueueJob,
  type ProcessCommentJob,
  type ProcessPostbackJob,
} from "./client";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import {
  MetaApiError,
  sendCommentReply,
  sendDirectMessage,
  sendDirectMessageWithButton,
  sendDirectMessageWithLinkButton,
  sendPrivateReply,
  sendPrivateReplyWithButton,
  sendPrivateReplyWithLinkButton,
} from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import { reserveDMSlot } from "@/lib/utils/rate-limiter";
import {
  releaseWorkspaceDMReservation,
  reserveWorkspaceDMSend,
} from "@/lib/billing/usage";
import { recordWorkerActivity, recordWorkerAlert } from "@/lib/ops/worker-health";
import {
  buildTrackedUrl,
  renderMessageWithTracking,
  renderMessageWithoutLink,
} from "@/lib/tracking/message";

const BACKOFF_DELAYS = [5 * 60 * 1000, 15 * 60 * 1000, 45 * 60 * 1000];

function formatError(error: unknown): string {
  if (error instanceof MetaApiError) {
    return `Meta API Error ${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

async function processComment(job: Job<ProcessCommentJob>): Promise<void> {
  const {
    instagramAccountId,
    commentId,
    commentText,
    commenterId,
    commenterName,
    mediaId,
  } = job.data;
  const requeueAttempt = job.data.requeueAttempt ?? 0;

  const automations = await prisma.automation.findMany({
    where: {
      // Match campaigns bound to this specific post, plus any-post campaigns.
      OR: [{ postId: mediaId }, { matchAnyPost: true }],
      isActive: true,
      instagramAccount: {
        instagramId: instagramAccountId,
      },
    },
    include: {
      instagramAccount: true,
      workspace: true,
      trackedLinks: {
        select: {
          slug: true,
          destinationUrl: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const automation of automations) {
    // "Any word" campaigns fire on every comment; otherwise require a keyword hit.
    const matchResult = automation.matchAnyWord
      ? { matched: true, matchedKeyword: null }
      : matchKeywords(
          commentText,
          automation.keywords,
          automation.wholeWordMatch
        );

    if (!matchResult.matched) {
      continue;
    }

    const existingLog = await prisma.dmLog.findUnique({
      where: {
        automationId_commentId: {
          automationId: automation.id,
          commentId,
        },
      },
    });

    const alreadyDmd = existingLog?.status === "SENT";
    const alreadyPublicReplied = Boolean(existingLog?.publicReplySentAt);
    const needsDm = !alreadyDmd;

    // Skip only when there is genuinely nothing left to do. A comment whose DM
    // already sent but whose public reply never posted (e.g. it hit a rate
    // limit) must still come back so the public reply can be retried.
    if (alreadyDmd && (alreadyPublicReplied || !automation.publicReplyEnabled)) {
      continue;
    }

    if (!automation.instagramAccount.accessToken) {
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        create: {
          workspaceId: automation.workspaceId,
          automationId: automation.id,
          instagramAccountId: automation.instagramAccountId,
          commenterId,
          commenterName,
          commentText,
          commentId,
          matchedKeyword: matchResult.matchedKeyword,
          status: "FAILED",
          errorMessage: "No Instagram access token available",
        },
        update: {
          status: "FAILED",
          errorMessage: "No Instagram access token available",
        },
      });
      continue;
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(automation.instagramAccount.accessToken);
    } catch {
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        create: {
          workspaceId: automation.workspaceId,
          automationId: automation.id,
          instagramAccountId: automation.instagramAccountId,
          commenterId,
          commenterName,
          commentText,
          commentId,
          matchedKeyword: matchResult.matchedKeyword,
          status: "FAILED",
          errorMessage: "Failed to decrypt Instagram access token",
        },
        update: {
          status: "FAILED",
          errorMessage: "Failed to decrypt Instagram access token",
        },
      });
      continue;
    }

    // Ensure a log row exists before the public reply leg (which updates it).
    // Only (re)set PENDING when the DM will actually be attempted, so a prior
    // SENT is never clobbered while we come back just to retry the public reply.
    if (!existingLog) {
      try {
        await prisma.dmLog.create({
          data: {
            workspaceId: automation.workspaceId,
            automationId: automation.id,
            instagramAccountId: automation.instagramAccountId,
            commenterId,
            commenterName,
            commentText,
            commentId,
            matchedKeyword: matchResult.matchedKeyword,
            status: "PENDING",
            attempts: job.attemptsMade + 1,
          },
        });
      } catch (error) {
        // A concurrent duplicate job for the same comment — the polling
        // reconciler enqueues without a deterministic jobId by design (see
        // lib/polling/comment-reconciler.ts) — can create this row between
        // our fetch of existingLog and now. Treat "it already exists" as a
        // race we lost, not a bug: leave whatever state the winning job set
        // untouched rather than crashing this job.
        const isDuplicateRow =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002";
        if (!isDuplicateRow) throw error;
      }
    } else if (needsDm) {
      await prisma.dmLog.update({
        where: {
          automationId_commentId: { automationId: automation.id, commentId },
        },
        data: {
          status: "PENDING",
          attempts: job.attemptsMade + 1,
          matchedKeyword: matchResult.matchedKeyword,
          errorMessage: null,
        },
      });
    }

    // Public reply leg — decoupled from the DM and posted first so a DM failure
    // (e.g. a non-follower whose messaging is restricted) never suppresses it.
    // Idempotent across retries via publicReplySentAt.
    const replyPool =
      automation.publicReplyMessages.length > 0
        ? automation.publicReplyMessages
        : automation.publicReplyMessage
          ? [automation.publicReplyMessage]
          : [];
    if (
      automation.publicReplyEnabled &&
      replyPool.length > 0 &&
      !existingLog?.publicReplySentAt
    ) {
      // Atomically claim the "send a public reply" slot instead of trusting
      // the existingLog check above: two concurrent job instances for the
      // same comment (e.g. the polling reconciler racing the webhook — the
      // reconciler deliberately has no deterministic jobId, see
      // lib/polling/comment-reconciler.ts) can both pass that check before
      // either has committed. Only the job whose conditional update
      // actually flips a row wins the race and proceeds to call Instagram.
      const claimed = await prisma.dmLog.updateMany({
        where: {
          automationId: automation.id,
          commentId,
          publicReplySentAt: null,
        },
        data: { publicReplySentAt: new Date() },
      });

      if (claimed.count > 0) {
        try {
          const chosen = replyPool[Math.floor(Math.random() * replyPool.length)];
          const publicReply = renderMessageWithTracking({
            message: chosen,
            commenterName,
            trackedLinks: automation.trackedLinks,
          });
          await sendCommentReply(accessToken, commentId, publicReply);
          await prisma.dmLog.update({
            where: {
              automationId_commentId: { automationId: automation.id, commentId },
            },
            data: { publicReplyError: null },
          });
        } catch (error) {
          console.error(
            "[DM Worker] Public comment reply failed:",
            formatError(error)
          );
          // Send failed — release the claim so a later pass can retry.
          await prisma.dmLog
            .update({
              where: {
                automationId_commentId: { automationId: automation.id, commentId },
              },
              data: {
                publicReplySentAt: null,
                publicReplyError: formatError(error),
              },
            })
            .catch(() => {});
        }
      }
    }

    // DM already sent on an earlier pass; the public reply retry above was all
    // this run needed. Don't re-send the DM.
    if (!needsDm) continue;

    // Atomically claim the DM-send slot — same race as the public reply
    // above (a concurrent duplicate job for this comment from the polling
    // reconciler's non-deterministic job IDs) applies equally here, and
    // `needsDm` above is a stale snapshot from the top of this function, not
    // a live check. Only the job that flips this row proceeds to send;
    // every exit below (skip, rate-limit, requeue, or failure) releases the
    // claim in the `finally` so retries still work.
    const dmClaim = await prisma.dmLog.updateMany({
      where: {
        automationId: automation.id,
        commentId,
        dmSentAt: null,
      },
      data: { dmSentAt: new Date() },
    });
    if (dmClaim.count === 0) continue;

    let dmSent = false;
    try {
    const usage = await reserveWorkspaceDMSend(automation.workspaceId);

    let rateLimit;
    try {
      rateLimit = await reserveDMSlot(instagramAccountId, requeueAttempt);
    } catch (error) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );
      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "FAILED",
          attempts: job.attemptsMade + 1,
          errorMessage: formatError(error),
        },
      });
      throw error;
    }

    if (!rateLimit.allowed) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );

      if (rateLimit.shouldSkip) {
        await prisma.dmLog.update({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId,
            },
          },
          data: {
            status: "SKIPPED_RATE_LIMIT",
            matchedKeyword: matchResult.matchedKeyword,
            errorMessage: "Hourly Instagram DM rate limit reached",
          },
        });
        continue;
      }

      if (rateLimit.shouldRequeue) {
        await prisma.dmLog.update({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId,
            },
          },
          data: {
            status: "PENDING",
            matchedKeyword: matchResult.matchedKeyword,
            errorMessage: "Hourly rate limit hit; retry scheduled",
          },
        });

        await getDMQueue().add(
          "process-comment",
          {
            ...job.data,
            requeueAttempt: requeueAttempt + 1,
          },
          {
            delay: rateLimit.requeueDelayMs,
            jobId: `comment_${instagramAccountId}_${commentId}_retry_${requeueAttempt + 1}`,
          }
        );
        continue;
      }
    }

    // With an opening DM, the private reply is a button message; tapping it
    // fires a postback that delivers either the follow step or the reveal
    // (see processPostback). Without an opening DM, we send the reveal text
    // directly as today.
    const useOpeningDm =
      automation.openingDmEnabled &&
      Boolean(automation.openingDmMessage) &&
      Boolean(automation.openingDmButtonLabel);
    const useFollowStep =
      automation.followStepEnabled &&
      Boolean(automation.followStepMessage) &&
      Boolean(automation.followStepButtonLabel);

    try {
      if (useOpeningDm) {
        const openingText = renderMessageWithTracking({
          message: automation.openingDmMessage as string,
          commenterName,
          trackedLinks: [],
        });
        const openingPayload = useFollowStep
          ? `follow:${automation.id}`
          : `reveal:${automation.id}`;
        await sendPrivateReplyWithButton(
          accessToken,
          automation.instagramAccount.instagramId,
          commentId,
          openingText,
          automation.openingDmButtonLabel as string,
          openingPayload
        );
      } else if (automation.trackedLinks[0]) {
        // Try button template first; if Meta rejects it, fall back to inline link.
        const bodyText =
          renderMessageWithoutLink({
            message: automation.dmMessage,
            commenterName,
          }) || "Here's your link:";
        const trackedUrl = buildTrackedUrl(automation.trackedLinks[0].slug);

        try {
          await sendPrivateReplyWithLinkButton(
            accessToken,
            automation.instagramAccount.instagramId,
            commentId,
            bodyText,
            automation.linkButtonLabel || "Open link",
            trackedUrl
          );
        } catch (buttonError) {
          // Button template rejected; send as text with inline link instead.
          console.log(
            "[DM Worker] Button template rejected, falling back to inline link:",
            formatError(buttonError)
          );
          const fallbackMessage =
            renderMessageWithTracking({
              message: automation.dmMessage,
              commenterName,
              trackedLinks: [automation.trackedLinks[0]],
            }) || `${bodyText}\n${trackedUrl}`;
          await sendPrivateReply(
            accessToken,
            automation.instagramAccount.instagramId,
            commentId,
            fallbackMessage
          );
        }
      } else {
        const dmMessage = renderMessageWithTracking({
          message: automation.dmMessage,
          commenterName,
          trackedLinks: automation.trackedLinks,
        });
        await sendPrivateReply(
          accessToken,
          automation.instagramAccount.instagramId,
          commentId,
          dmMessage
        );
      }

      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "SENT",
          dmSentAt: new Date(),
          errorMessage: null,
        },
      });
      dmSent = true;
    } catch (error) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );

      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "FAILED",
          attempts: job.attemptsMade + 1,
          errorMessage: formatError(error),
        },
      });
      throw error;
    }
    } finally {
      if (!dmSent) {
        await prisma.dmLog
          .update({
            where: {
              automationId_commentId: { automationId: automation.id, commentId },
            },
            data: { dmSentAt: null },
          })
          .catch(() => {});
      }
    }
  }
}

/**
 * Deliver the follow-step message after a user taps an opening DM's button,
 * when the campaign has a follow step configured. The postback payload is
 * `follow:<automationId>`. The follow step's own button carries
 * `reveal:<automationId>`, so tapping it delivers the reveal exactly like a
 * campaign without a follow step.
 */
async function processFollowPostback(
  instagramAccountId: string,
  userId: string,
  automationId: string
): Promise<void> {
  const automation = await prisma.automation.findFirst({
    where: { id: automationId, isActive: true },
    include: { instagramAccount: true },
  });

  if (
    !automation ||
    automation.instagramAccount.instagramId !== instagramAccountId ||
    !automation.instagramAccount.accessToken ||
    !automation.followStepEnabled ||
    !automation.followStepMessage ||
    !automation.followStepButtonLabel
  ) {
    return;
  }

  const dedupeId = `follow:${userId}`;

  const openingLog = await prisma.dmLog.findFirst({
    where: { automationId: automation.id, commenterId: userId },
    select: { commenterName: true },
  });
  const commenterName = openingLog?.commenterName ?? null;

  let accessToken: string;
  try {
    accessToken = decryptToken(automation.instagramAccount.accessToken);
  } catch {
    return;
  }

  const usage = await reserveWorkspaceDMSend(automation.workspaceId);

  try {
    const followText = renderMessageWithTracking({
      message: automation.followStepMessage,
      commenterName,
      trackedLinks: [],
    });
    await sendDirectMessageWithButton(
      accessToken,
      automation.instagramAccount.instagramId,
      userId,
      followText,
      automation.followStepButtonLabel,
      `reveal:${automation.id}`
    );
    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        status: "SENT",
        dmSentAt: new Date(),
      },
      update: { status: "SENT", dmSentAt: new Date(), errorMessage: null },
    });
  } catch (error) {
    await releaseWorkspaceDMReservation(automation.workspaceId, usage.periodStart);
    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        status: "FAILED",
        errorMessage: formatError(error),
      },
      update: { status: "FAILED", errorMessage: formatError(error) },
    });
    throw error;
  }
}

/**
 * Deliver the reveal message after a user taps an opening DM's button (or,
 * when a follow step is configured, after tapping the follow step's own
 * button). The postback payload is `reveal:<automationId>`; the sender is
 * the user's IGSID (same id as their comment author id), which we DM
 * directly.
 */
async function processRevealPostback(
  instagramAccountId: string,
  userId: string,
  automationId: string
): Promise<void> {
  const automation = await prisma.automation.findFirst({
    where: { id: automationId, isActive: true },
    include: {
      instagramAccount: true,
      workspace: true,
      trackedLinks: {
        select: { slug: true, destinationUrl: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (
    !automation ||
    automation.instagramAccount.instagramId !== instagramAccountId ||
    !automation.instagramAccount.accessToken
  ) {
    return;
  }

  // Duplicate sends are enabled: every button tap re-sends the reveal
  // instead of only firing once per person.
  const dedupeId = `reveal:${userId}`;

  // Personalize {username} from the opening DM log for this user, if present.
  const openingLog = await prisma.dmLog.findFirst({
    where: { automationId: automation.id, commenterId: userId },
    select: { commenterName: true },
  });
  const commenterName = openingLog?.commenterName ?? null;

  let accessToken: string;
  try {
    accessToken = decryptToken(automation.instagramAccount.accessToken);
  } catch {
    return;
  }

  const usage = await reserveWorkspaceDMSend(automation.workspaceId);

  const primaryLink = automation.trackedLinks[0];

  try {
    if (primaryLink) {
      // Try button template first; if Meta rejects it, fall back to inline link.
      const bodyText =
        renderMessageWithoutLink({
          message: automation.dmMessage,
          commenterName,
        }) || "Here's your link:";
      const trackedUrl = buildTrackedUrl(primaryLink.slug);

      try {
        await sendDirectMessageWithLinkButton(
          accessToken,
          automation.instagramAccount.instagramId,
          userId,
          bodyText,
          automation.linkButtonLabel || "Open link",
          trackedUrl
        );
      } catch (buttonError) {
        // Button template rejected; send as text with inline link instead.
        console.log(
          "[DM Worker] Button template rejected in postback, falling back to inline link:",
          formatError(buttonError)
        );
        const fallbackMessage =
          renderMessageWithTracking({
            message: automation.dmMessage,
            commenterName,
            trackedLinks: [primaryLink],
          }) || `${bodyText}\n${trackedUrl}`;
        await sendDirectMessage(
          accessToken,
          automation.instagramAccount.instagramId,
          userId,
          fallbackMessage
        );
      }
    } else {
      const revealMessage = renderMessageWithTracking({
        message: automation.dmMessage,
        commenterName,
        trackedLinks: automation.trackedLinks,
      });
      await sendDirectMessage(
        accessToken,
        automation.instagramAccount.instagramId,
        userId,
        revealMessage
      );
    }
    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        status: "SENT",
        dmSentAt: new Date(),
      },
      update: { status: "SENT", dmSentAt: new Date(), errorMessage: null },
    });
  } catch (error) {
    await releaseWorkspaceDMReservation(automation.workspaceId, usage.periodStart);
    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        status: "FAILED",
        errorMessage: formatError(error),
      },
      update: { status: "FAILED", errorMessage: formatError(error) },
    });
    throw error;
  }
}

/**
 * Dispatches a postback job to the follow step or the reveal, based on the
 * payload prefix set when the triggering button was sent.
 */
async function processPostback(job: Job<ProcessPostbackJob>): Promise<void> {
  const { instagramAccountId, userId, payload } = job.data;

  if (payload.startsWith("follow:")) {
    const automationId = payload.slice("follow:".length);
    return processFollowPostback(instagramAccountId, userId, automationId);
  }
  if (payload.startsWith("reveal:")) {
    const automationId = payload.slice("reveal:".length);
    return processRevealPostback(instagramAccountId, userId, automationId);
  }
}

async function processJob(job: Job<DmQueueJob>): Promise<void> {
  if (job.name === POSTBACK_JOB_NAME) {
    return processPostback(job as Job<ProcessPostbackJob>);
  }
  return processComment(job as Job<ProcessCommentJob>);
}

async function recordWorkerFailure(
  job: Job<DmQueueJob> | undefined,
  error: Error
) {
  try {
    const instagramAccountId = job?.data.instagramAccountId;
    const commentId =
      job && "commentId" in job.data ? job.data.commentId : null;
    const account = instagramAccountId
      ? await prisma.instagramAccount.findUnique({
          where: { instagramId: instagramAccountId },
          select: { workspaceId: true },
        })
      : null;

    await prisma.operationalEvent.create({
      data: {
        workspaceId: account?.workspaceId ?? null,
        source: "WORKER",
        level: "ERROR",
        message: `DM worker job ${job?.id ?? "unknown"} failed: ${error.message}`,
        payload: {
          jobId: job?.id ?? null,
          attemptsMade: job?.attemptsMade ?? null,
          instagramAccountId: instagramAccountId ?? null,
          commentId,
        },
      },
    });

    await recordWorkerAlert({
      level: "error",
      message: error.message,
      jobId: job?.id,
      instagramAccountId,
      commentId: commentId ?? undefined,
    });
  } catch (recordError) {
    console.error(
      "[DM Worker] Failed to record worker failure:",
      formatError(recordError)
    );
  }
}

export function createDMWorker(): Worker<DmQueueJob> {
  const worker = new Worker<DmQueueJob>(
    "dm-processing",
    processJob,
    {
      connection: getRedisConnection(),
      concurrency: 5,
      // Defaults (drainDelay: 5s, stalledInterval: 30s) re-poll Redis constantly
      // even with an empty queue, which burns commands fast on a metered free
      // tier — Upstash bills every command *inside* the stalled-check Lua script
      // (7+ sub-commands per run), not just the EVALSHA call, so stalledInterval
      // dominates idle cost far more than drainDelay. New jobs still wake the
      // worker immediately regardless of either setting — they only govern
      // idle re-poll/re-check cadence — so raising both is free in terms of
      // responsiveness for this low-volume single-account use. A 5-minute
      // stalled window just means a crashed job takes up to 5 min longer to
      // recover, an acceptable tradeoff given attempts: 3 and a single worker.
      drainDelay: 300,
      stalledInterval: 300_000,
      settings: {
        backoffStrategy: (attemptsMade: number) =>
          BACKOFF_DELAYS[Math.min(attemptsMade - 1, BACKOFF_DELAYS.length - 1)],
      },
    }
  );

  worker.on("active", () => {
    void recordWorkerActivity();
  });

  worker.on("completed", (job) => {
    console.log(`[DM Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[DM Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
      err.message
    );
    void recordWorkerFailure(job, err);
  });

  worker.on("error", (err) => {
    console.error("[DM Worker] Worker error:", err.message);
    void prisma.operationalEvent
      .create({
        data: {
          source: "WORKER",
          level: "ERROR",
          message: `DM worker process error: ${err.message}`,
          payload: { name: err.name },
        },
      })
      .catch((recordError) => {
        console.error(
          "[DM Worker] Failed to record worker process error:",
          formatError(recordError)
        );
      });
  });

  return worker;
}

