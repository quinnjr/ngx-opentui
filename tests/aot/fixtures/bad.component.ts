import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'

@Component({
  selector: 'bad-fixture',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<text>{{ missingProperty }}</text>`,
})
export class BadFixture {}
