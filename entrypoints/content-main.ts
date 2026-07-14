export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start', // start early so it's ready when isolated world checks
  world: 'MAIN',
  async main() {
    const { } = await import('../src/content/main-world');
    // main-world.ts self-initialises by attaching the message listener on import
  },
});
