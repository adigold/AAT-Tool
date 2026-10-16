import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Replace with your own admin check (session, cookie, Clerk, NextAuth...).
 * It denies by default, so the route does nothing until you wire it.
 */
async function isAdmin(_req: Request): Promise<boolean> {
  return false;
}

/**
 * AAT (Admin Annotation Tool), localhost only: saves a note's screenshot to .data/aat/ in the project
 * (add `.data/` to .gitignore), so the "prompt to Claude" can point at the file.
 * Admins only; 404 on a hosting platform or on any other host.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (process.env.NETLIFY || process.env.VERCEL || (url.hostname !== "localhost" && url.hostname !== "127.0.0.1")) {
    return new Response("Not found", { status: 404 });
  }
  if (!(await isAdmin(req))) return new Response("Forbidden", { status: 403 });
  const name = url.searchParams.get("name") ?? "";
  if (!/^aat-[a-z0-9-]{4,60}\.png$/.test(name)) return new Response("Bad request", { status: 400 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) return new Response("Bad request", { status: 400 });
  const dir = path.join(process.cwd(), ".data", "aat");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return Response.json({ file: `.data/aat/${name}` });
}
