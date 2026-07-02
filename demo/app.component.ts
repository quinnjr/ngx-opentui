import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  type ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core'
import type { InputRenderable } from '@opentui/core'
import { TuiKeyboard } from '../src'

interface Task {
  label: string
  done: boolean
}

// A focused OpenTUI <input> receives keystrokes, so nav keys and typing
// must not overlap: nav mode by default, `n` focuses the input, Enter
// adds the task and returns to nav mode, Escape bails out.
@Component({
  selector: 'task-app',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <box flexDirection="column" padding="1" width="100%" height="100%">
      <box border="true" title=" ngx-opentui tasks " flexDirection="column" flexGrow="1" paddingX="1">
        @if (tasks().length === 0) {
          <text>No tasks yet — press n, type one, press Enter.</text>
        }
        @for (task of tasks(); track $index) {
          <text>{{ $index === selected() ? '>' : ' ' }} {{ task.done ? '[x]' : '[ ]' }} {{ task.label }}</text>
        }
      </box>
      <input placeholder="n to type a new task — Enter adds it" (enter)="add()" #inp />
      <text>{{ doneCount() }}/{{ tasks().length }} done · up/down select · space toggle · n new · q quit</text>
    </box>
  `,
})
export class TaskApp {
  // decorator query, not viewChild(): JIT cannot detect signal-query
  // field initializers from decorator metadata alone
  @ViewChild('inp') private inputRef!: ElementRef<InputRenderable>
  readonly tasks = signal<Task[]>([
    { label: 'run the demo', done: true },
    { label: 'toggle a task with space', done: false },
  ])
  readonly selected = signal(0)
  readonly doneCount = computed(() => this.tasks().filter((t) => t.done).length)

  constructor() {
    inject(TuiKeyboard).onKey((key) => {
      const input = this.inputRef?.nativeElement
      if (input?.focused) {
        if (key.name === 'escape') input.blur()
        return
      }
      const last = this.tasks().length - 1
      if (key.name === 'up') this.selected.update((i) => Math.max(0, i - 1))
      if (key.name === 'down') this.selected.update((i) => Math.min(last, i + 1))
      if (key.name === 'space') this.toggle()
      if (key.name === 'n') input?.focus()
      if (key.name === 'q') process.exit(0)
    })
  }

  add(): void {
    // (enter) only fires from the input itself, so the ref exists
    const input = this.inputRef.nativeElement
    const label = input.value.trim()
    if (label) this.tasks.update((tasks) => [...tasks, { label, done: false }])
    input.value = ''
    input.blur()
  }

  toggle(): void {
    const index = this.selected()
    this.tasks.update((tasks) =>
      tasks.map((task, i) => (i === index ? { ...task, done: !task.done } : task)),
    )
  }
}
