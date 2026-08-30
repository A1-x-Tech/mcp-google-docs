import { ConfigError, CredentialsError, loadConfig } from "./config.js";
import { GoogleDocsClient } from "./client.js";

/**
 * Live smoke check against the real Google APIs.
 *
 * Default mode is READ-ONLY: with a document id (argv or
 * GOOGLE_DOCS_SMOKE_DOCUMENT_ID) it fetches the document; otherwise it just
 * mints an access token from the refresh token — either way the credentials
 * are exercised for real and nothing is written.
 *
 * Opt-in write mode (GOOGLE_DOCS_SMOKE_LIVE_WRITE=1) runs the full loop on a
 * DISPOSABLE document: create -> insert text -> read back -> export markdown,
 * and deletes the document in a finally block, so the cleanup runs after
 * success and failure alike. It never touches an existing document.
 */
async function main(): Promise<void> {
  const client = new GoogleDocsClient(loadConfig());

  if (process.env.GOOGLE_DOCS_SMOKE_LIVE_WRITE === "1") {
    await liveWriteScenario(client);
    return;
  }

  const documentId = process.argv[2] ?? process.env.GOOGLE_DOCS_SMOKE_DOCUMENT_ID;
  if (documentId) {
    const document = (await client.getDocument({ documentId })) as {
      title?: string;
      revisionId?: string;
    };
    console.log(JSON.stringify({ documentId, title: document.title, revisionId: document.revisionId }, null, 2));
    return;
  }
  console.log(JSON.stringify(await client.authCheck(), null, 2));
}

async function liveWriteScenario(client: GoogleDocsClient): Promise<void> {
  const title = `mcp-google-docs smoke ${new Date().toISOString()}`;
  const created = (await client.createDocument(title)) as { documentId?: string };
  const documentId = created.documentId;
  if (!documentId) throw new Error("documents.create returned no documentId");
  console.log(`created disposable document ${documentId}`);
  try {
    await client.insertText({ documentId, text: "Hello from the smoke test.\n" });
    const text = (await client.readDocumentText({ documentId })) as { tabs: { blocks: unknown[] }[] };
    if (!text.tabs.length || !text.tabs[0].blocks.length) {
      throw new Error("inserted text did not come back from read_document_text");
    }
    const markdown = new TextDecoder().decode(await client.exportDocument({ documentId, format: "markdown" }));
    if (!markdown.includes("Hello from the smoke test")) {
      throw new Error("markdown export did not contain the inserted text");
    }
    console.log(JSON.stringify({ ok: true, documentId, markdownBytes: markdown.length }, null, 2));
  } finally {
    // Cleanup runs after success AND failure — the disposable doc never outlives the run.
    try {
      await client.deleteFile(documentId);
      console.log(`deleted disposable document ${documentId}`);
    } catch (cleanupErr) {
      console.error(`cleanup failed — delete ${documentId} manually:`, cleanupErr);
    }
  }
}

main().catch((err) => {
  // Missing or malformed credentials are a user error, not a bug: no stack.
  const userError = err instanceof ConfigError || err instanceof CredentialsError;
  console.error("smoke failed:", userError ? err.message : err);
  process.exit(1);
});
