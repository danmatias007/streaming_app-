import { createServer } from "vite";

export default async function globalSetup() {
  if (!process.env.CI && await isOnline("http://127.0.0.1:5173")) return;
  const server = await createServer({ server: { host:"127.0.0.1",port:5173,strictPort:true } });
  await server.listen();
  return async () => { await server.close(); };
}

async function isOnline(url:string) {
  try { const response=await fetch(url,{signal:AbortSignal.timeout(1_000)}); return response.ok; }
  catch { return false; }
}
