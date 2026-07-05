export default function cwClarifyWatchdog(pi: { on: (event: string, handler: () => Promise<void>) => void; $?: (strings: TemplateStringsArray, ...values: string[]) => Promise<unknown> }) {
  pi.on("session_idle", async () => {
    if (pi.$ === undefined) {
      return;
    }
    await pi.$`cw internal validate-clarify --watchdog`;
  });
}
