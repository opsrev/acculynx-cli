import TurndownService from "turndown";
import type { Command } from "commander";
import type { UnofficialClient } from "../unofficial-client.js";

function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
  });

  // Strip images — not useful for AI agents
  td.addRule("removeImages", {
    filter: "img",
    replacement: () => "",
  });

  // Strip style/script tags completely
  td.addRule("removeStyle", {
    filter: ["style", "script"],
    replacement: () => "",
  });

  return td;
}

const looksLikeHtml = /<[a-z][\s\S]*?>/i;

function cleanMessage(html: string): string {
  if (!looksLikeHtml.test(html)) return html;
  const td = createTurndown();
  return td
    .turndown(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface Recipient {
  id: string;
  companyUserId: string;
  Sent: boolean;
  SentDate: string | null;
  Delivered: boolean;
  DeliveredDate: string | null;
  Failed: boolean;
  FailedDate: string | null;
  FailedDescription: string | null;
}

interface JobMessage {
  id: string;
  LocationId: string;
  JobId: string;
  CreatedDate: string;
  LatestMessage: string;
  CreatedBy: string;
  CreatedByID: string;
  CreatedByProfilerPicture: string;
  ParentMessageId: string | null;
  AttachmentOnly: boolean;
  Message: string;
  RawMessage: string;
  PreTranslationMessage: string | null;
  RoleId: string;
  MessageType: string;
  Type: string;
  Recipients: Recipient[];
  Attachments: unknown[];
  Subject: string | null;
  SentDate: string | null;
  ReplyEmail: string | null;
  ChildMessages: JobMessage[];
  ChildMessageIds: string[];
  AllCreatedByIds: string[];
  AdminMessage: string;
  Translations: unknown[];
  OriginalMessage: string;
}

interface MessageFeedResponse {
  TotalRecords: number;
  CurrentPage: number;
  TotalPages: number;
  SearchTerm: string | null;
  results: JobMessage[];
}

export function registerMessagesCommands(
  parentCmd: Command,
  getClient: () => UnofficialClient
): void {
  const messages = parentCmd
    .command("messages")
    .description("Job message/comment operations");

  messages
    .command("list")
    .argument("<jobId>", "Job ID (GUID)")
    .option(
      "--sort <sort>",
      "Sort field and direction (field|asc or field|desc)",
      "createdDate|desc"
    )
    .option("--count-only", "Return only the total count of messages")
    .option(
      "--type <type>",
      "Filter by message type: Comment, Email, or Signatures"
    )
    .description("List all messages and comments for a job")
    .action(async (jobId: string, opts) => {
      const params = new URLSearchParams({ sort: opts.sort });
      if (opts.countOnly) {
        params.set("countOnly", "true");
      }
      if (opts.type) {
        params.append("filters", `type=${opts.type}`);
      }

      const data = (await getClient().get(
        `/api/jobs/${jobId}/JobMessageFeed?${params.toString()}`
      )) as MessageFeedResponse;

      if (opts.countOnly) {
        console.log(JSON.stringify({ totalRecords: data.TotalRecords }));
        return;
      }

      const result = {
        totalRecords: data.TotalRecords,
        currentPage: data.CurrentPage,
        totalPages: data.TotalPages,
        messages: data.results.map((msg) => ({
          id: msg.id,
          jobId: msg.JobId,
          type: msg.Type,
          messageType: msg.MessageType,
          message: cleanMessage(msg.Message),
          subject: msg.Subject,
          createdBy: msg.CreatedBy,
          createdById: msg.CreatedByID,
          createdDate: msg.CreatedDate,
          latestMessage: msg.LatestMessage,
          parentMessageId: msg.ParentMessageId,
          attachmentOnly: msg.AttachmentOnly,
          replyEmail: msg.ReplyEmail,
          sentDate: msg.SentDate,
          recipients: msg.Recipients.map((r) => ({
            id: r.id,
            companyUserId: r.companyUserId,
            sent: r.Sent,
            sentDate: r.SentDate,
            delivered: r.Delivered,
            deliveredDate: r.DeliveredDate,
            failed: r.Failed,
            failedDate: r.FailedDate,
            failedDescription: r.FailedDescription,
          })),
          attachments: msg.Attachments,
          childMessageCount: msg.ChildMessages.length,
          childMessages: msg.ChildMessages.map((child) => ({
            id: child.id,
            type: child.Type,
            message: cleanMessage(child.Message),
            createdBy: child.CreatedBy,
            createdDate: child.CreatedDate,
          })),
        })),
      };

      console.log(JSON.stringify(result));
    });

  messages
    .command("post")
    .argument("<jobId>", "Job ID (GUID)")
    .argument("<message>", "Message text to post")
    .option(
      "--notify <userIds>",
      "Comma-separated user IDs (GUIDs) to notify"
    )
    .description("Post a comment/message to a job, optionally notifying users")
    .action(async (jobId: string, message: string, opts) => {
      const emailRecipients = opts.notify
        ? opts.notify.split(",").map((id: string) => id.trim())
        : [];

      const data = (await getClient().post(
        `/api/jobs/${jobId}/Messages`,
        {
          JobId: jobId,
          Message: message,
          RoleId: "1111111",
          MessageType: "General Comment",
          emailRecipients,
          index: -1,
        }
      )) as Record<string, unknown>;

      console.log(
        JSON.stringify({
          id: data.JobMessageId,
          jobId: data.JobId,
          message: data.Message,
          messageType: data.MessageType,
          createdDate: data.CreatedDate,
          notified: emailRecipients.length,
        })
      );
    });
}
