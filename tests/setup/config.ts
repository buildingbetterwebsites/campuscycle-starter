import config from '@/payload.config'

// Keep routine migration and first-admin logs out of test output. Errors still reach the runner.
export default config.then(value => {
  // SanitizedConfig's deep-required type also marks optional logger settings as required.
  value.logger = { options: { level: 'error' } } as typeof value.logger
  // Uploaded images go to a temporary folder (made by tests/setup/pglite.ts, deleted after the run),
  // not to the project's own media folder, where they would pile up or clash with your own uploads.
  const media = value.collections.find(collection => collection.slug === 'media')
  if (media?.upload && process.env.TEST_MEDIA_DIR) media.upload.staticDir = process.env.TEST_MEDIA_DIR
  return value
})
