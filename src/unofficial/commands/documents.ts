import { writeFileSync } from "node:fs";
import type { Command } from "commander";
import type { UnofficialClient } from "../unofficial-client.js";

interface DocumentFile {
  Id: string;
  Name: string;
  Extension: string;
  MIMEType: string;
  Size: number;
  Href: string;
  CreatedByDisplayName: string;
  ModifiedDateUTC: string;
}

interface DocumentFolder {
  Id: string;
  Name: string;
  FileCount: number;
  Files: DocumentFile[];
}

export function registerDocumentsCommands(
  parentCmd: Command,
  getClient: () => UnofficialClient
): void {
  const docs = parentCmd
    .command("documents")
    .description("Job document operations");

  docs
    .command("list")
    .argument("<jobId>", "Job ID (GUID)")
    .description("List all document folders and files for a job")
    .action(async (jobId: string) => {
      const folders = (await getClient().get(
        `/api/v4/job-documents/${jobId}/job-document-folders`
      )) as DocumentFolder[];

      const result = folders.map((folder) => ({
        folder: folder.Name,
        folderId: folder.Id,
        fileCount: folder.FileCount,
        files: folder.Files.map((f) => ({
          id: f.Id,
          name: f.Name,
          extension: f.Extension,
          size: f.Size,
          mimeType: f.MIMEType,
          href: f.Href,
          createdBy: f.CreatedByDisplayName,
          modifiedDate: f.ModifiedDateUTC,
        })),
      }));

      console.log(JSON.stringify(result));
    });

  docs
    .command("download")
    .argument("<jobId>", "Job ID (GUID)")
    .argument("<fileId>", "File ID (GUID)")
    .option("--output <path>", "Write to file instead of stdout")
    .description("Download a document file")
    .action(async (jobId: string, fileId: string, opts) => {
      // First, resolve the file's Href from the folders API
      const folders = (await getClient().get(
        `/api/v4/job-documents/${jobId}/job-document-folders`
      )) as DocumentFolder[];

      let targetFile: DocumentFile | undefined;
      for (const folder of folders) {
        targetFile = folder.Files.find((f) => f.Id === fileId);
        if (targetFile) break;
      }

      if (!targetFile) {
        throw new Error(
          `File ${fileId} not found in job ${jobId} documents`
        );
      }

      const buffer = await getClient().getBuffer(targetFile.Href);

      if (opts.output) {
        writeFileSync(opts.output, buffer);
        console.error(
          JSON.stringify({
            status: "ok",
            file: targetFile.Name,
            size: buffer.length,
            output: opts.output,
          })
        );
      } else {
        process.stdout.write(buffer);
      }
    });
}
