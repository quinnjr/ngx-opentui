import { Component, NO_ERRORS_SCHEMA, signal } from '@angular/core'
import { bootstrapTuiApplication } from '../../../src'

@Component({
  selector: 'cli-fixture',
  schemas: [NO_ERRORS_SCHEMA],
  template: `<box padding="1"><text>cli-fixture: {{ label() }}</text></box>`,
})
export class CliFixtureApp {
  readonly label = signal('ok')
}

export async function bootstrapCliFixture(renderer: unknown) {
  return bootstrapTuiApplication(CliFixtureApp, { renderer: renderer as never })
}
