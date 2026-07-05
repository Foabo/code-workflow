export default async function cwClarifyWatchdog({ $, event }: { $: unknown; event: { type?: string } }) {
  if (event.type !== "session.idle") {
    return;
  }
  const runner = $ as (strings: TemplateStringsArray, ...values: string[]) => Promise<unknown>;
  await runner`cw internal validate-clarify --watchdog`;
}
