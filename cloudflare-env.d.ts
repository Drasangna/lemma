declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
    CROSSREF_MAILTO?: string;
  }
}
