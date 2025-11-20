import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { processEmailRetryQueue } from '../services/emailRetryQueue'
import { getValidatedEnv } from '../utils/env'

const jobs = new Hono()

jobs.post('/email-retry', async (c) => {
  const env = getValidatedEnv(c)
  const secret = c.req.header('X-Cron-Secret') ?? ''

  if (!env.CRON_JOB_SECRET || secret !== env.CRON_JOB_SECRET) {
    throw new HTTPException(403, { message: 'Unauthorized job invocation.' })
  }

  const { processed, successCount, failureCount } = await processEmailRetryQueue(c)

  return c.json({ processed, successCount, failureCount })
})

export default jobs
