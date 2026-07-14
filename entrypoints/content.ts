export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    const { run } = await import('../src/content/index');
    await run();
  },
});
