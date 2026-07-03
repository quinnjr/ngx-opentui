import { Component, NO_ERRORS_SCHEMA, signal } from '@angular/core'

@Component({
  selector: 'greeting-fixture',
  schemas: [NO_ERRORS_SCHEMA],
  template: `<box padding="1"><text>hello, {{ name() }}</text></box>`,
})
export class GreetingFixture {
  readonly name = signal('world')
}
