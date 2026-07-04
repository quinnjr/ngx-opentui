import { TaskApp } from '../../../demo/app.component'
import { bootstrapTuiApplication } from '../../../src'

export { TaskApp }

export async function bootstrapTaskAppHeadless(renderer: unknown) {
  return bootstrapTuiApplication(TaskApp, { renderer: renderer as never })
}
