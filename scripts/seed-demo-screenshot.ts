/**
 * One-off seed for a local-only screenshot of the Campaigns page.
 * Never run against a real DATABASE_URL — this is throwaway demo data.
 */
import { prisma } from "@/lib/db/client";

function daysAgo(n: number, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Demo Creator",
      email: "demo@example.com",
      emailVerified: new Date(),
    },
  });

  const sessionToken = "demo-screenshot-session-token";
  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Demo Workspace",
      ownerId: user.id,
      utcOffsetMinutes: 480,
      dmsSentThisPeriod: 3120,
    },
  });

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
  });

  const account = await prisma.instagramAccount.create({
    data: {
      workspaceId: workspace.id,
      instagramId: "17800000000000001",
      username: "mike1ros.jpg",
      name: "mike1ros.jpg",
      accessToken: "demo-not-a-real-token",
      tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      webhookSubscribed: true,
    },
  });

  const presetsAutomation = await prisma.automation.create({
    data: {
      workspaceId: workspace.id,
      instagramAccountId: account.id,
      name: "Preset pack reel",
      goal: "Send the preset pack to anyone who comments PRESETS",
      postUrl: "https://instagram.com/p/demo1",
      keywords: ["PRESETS", "PACK"],
      dmMessage: "Hey {username}! Here's the preset pack 👉 link in bio",
      publicReplyEnabled: true,
      publicReplyMessage: "Sent! Check your DMs 📩",
      isActive: true,
    },
  });

  const portfolioAutomation = await prisma.automation.create({
    data: {
      workspaceId: workspace.id,
      instagramAccountId: account.id,
      name: "Portfolio inquiries",
      goal: "Send the portfolio link to anyone who comments PORTFOLIO",
      postUrl: "https://instagram.com/p/demo2",
      keywords: ["PORTFOLIO"],
      dmMessage: "Thanks for asking! Here's my portfolio 👉 link in bio",
      isActive: true,
    },
  });

  const btsAutomation = await prisma.automation.create({
    data: {
      workspaceId: workspace.id,
      instagramAccountId: account.id,
      name: "Behind the lens",
      goal: "Send a BTS discount code",
      postUrl: "https://instagram.com/p/demo3",
      keywords: ["BTS"],
      dmMessage: "Use code LENS10 for 10% off prints 👉 link in bio",
      isActive: false,
    },
  });

  const commenters = [
    "maya.co", "jordan.k", "the_realmarco", "aisha.does.style", "leo__wong",
    "ravi.creates", "sophie.b", "danny_on_ig", "priya.shoots", "nathan.codes",
    "olivia_travels", "hiro.tanaka", "ella.makes", "marcus_films", "zara.k",
    "tomas.rivera", "yuki.snaps", "chloe.designs", "kwame.o", "isla.moon",
    "felix.reads", "nadia.creates", "omar.builds", "lily.wanders", "theo.codes",
    "amara.styles", "victor.shoots", "ingrid.paints", "sam.travels", "noor.designs",
  ];
  const automations = [presetsAutomation, portfolioAutomation, btsAutomation];
  const weights = [0.5, 0.35, 0.15]; // presets is the busiest, BTS the quietest

  function pickAutomation() {
    const r = Math.random();
    if (r < weights[0]) return automations[0];
    if (r < weights[0] + weights[1]) return automations[1];
    return automations[2];
  }

  let dmCount = 0;
  for (let day = 0; day < 90; day++) {
    const sendsToday = day === 0 ? 14 : Math.floor(Math.random() * 12) + 3;
    for (let i = 0; i < sendsToday; i++) {
      const automation = pickAutomation();
      const commenter = commenters[Math.floor(Math.random() * commenters.length)];
      const createdAt = daysAgo(day, 9 + Math.floor(Math.random() * 10));
      const roll = Math.random();
      const status = roll < 0.92 ? "SENT" : roll < 0.97 ? "FAILED" : "SKIPPED_RATE_LIMIT";
      dmCount++;
      await prisma.dmLog.create({
        data: {
          workspaceId: workspace.id,
          automationId: automation.id,
          instagramAccountId: account.id,
          commenterId: `ig_${commenter}_${dmCount}`,
          commenterName: commenter,
          commentText: automation.keywords[0] + " please!",
          commentId: `comment_${dmCount}`,
          matchedKeyword: automation.keywords[0],
          status,
          attempts: 1,
          dmSentAt: status === "SENT" ? createdAt : null,
          errorMessage: status === "FAILED" ? "Rate limited by Meta, retry scheduled" : null,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }
  }

  const presetsLink = await prisma.trackedLink.create({
    data: {
      workspaceId: workspace.id,
      automationId: presetsAutomation.id,
      destinationUrl: "https://example.com/presets",
      slug: "demo-presets",
    },
  });
  const portfolioLink = await prisma.trackedLink.create({
    data: {
      workspaceId: workspace.id,
      automationId: portfolioAutomation.id,
      destinationUrl: "https://example.com/portfolio",
      slug: "demo-portfolio",
    },
  });

  for (let i = 0; i < 640; i++) {
    await prisma.linkClick.create({
      data: {
        workspaceId: workspace.id,
        automationId: presetsAutomation.id,
        trackedLinkId: presetsLink.id,
        instagramAccountId: account.id,
        createdAt: daysAgo(Math.floor(Math.random() * 90)),
      },
    });
  }
  for (let i = 0; i < 210; i++) {
    await prisma.linkClick.create({
      data: {
        workspaceId: workspace.id,
        automationId: portfolioAutomation.id,
        trackedLinkId: portfolioLink.id,
        instagramAccountId: account.id,
        createdAt: daysAgo(Math.floor(Math.random() * 90)),
      },
    });
  }

  console.log("Seeded demo workspace:", workspace.id);
  console.log("Total DM logs:", dmCount);
  console.log("Session token to use as cookie value:", sessionToken);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
