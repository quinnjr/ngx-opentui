import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject, signal } from '@angular/core'
import { TuiFocus, TuiKeyboard } from '../src'

interface Task {
  label: string
  done: boolean
}

// Focus is the mode switch: while an input holds focus, typing wins and
// nav keys are ignored (Escape returns to nav). Tab/shift+tab cycle the
// two inputs via TuiFocus; state flows through signals + [(value)].
@Component({
  selector: 'task-app',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <box flexDirection="column" padding="1" width="100%" height="100%">
      <box border="true" title=" ngx-opentui tasks " flexDirection="column" flexGrow="1" paddingX="1">
        @if (visible().length === 0) {
          <text>@if (filter()) {Nothing matches "{{ filter() }}".} @else {No tasks yet — tab to the input, type, press Enter.}</text>
        }
        @for (task of visible(); track $index) {
          <text>{{ $index === cursor() ? '>' : ' ' }} @if (task.done) {<span fg="#7fbf7f">[x] {{ task.label }}</span>} @else {[ ] {{ task.label }}}</text>
        }
      </box>
      <input placeholder="new task — Enter adds it" [(value)]="draft" (enter)="add()" />
      <input placeholder="filter tasks" [(value)]="filter" />
      <text>{{ doneCount() }}/{{ tasks().length }} done@if (filter()) { · showing {{ visible().length }}}@if (allDone()) {<span fg="#7fbf7f"> · all clear!</span>} · tab focus · esc nav · space toggle · q quit</text>
    </box>
  `,
})
export class TaskApp {
  private readonly focus = inject(TuiFocus)
  readonly tasks = signal<Task[]>([
    { label: 'run the demo', done: true },
    { label: 'toggle a task with space', done: false },
  ])
  readonly draft = signal('')
  readonly filter = signal('')
  readonly selected = signal(0)
  readonly visible = computed(() => {
    const needle = this.filter().trim().toLowerCase()
    return needle ? this.tasks().filter((t) => t.label.toLowerCase().includes(needle)) : this.tasks()
  })
  // the raw selection survives filter changes; the cursor is what's shown
  readonly cursor = computed(() => Math.min(this.selected(), Math.max(0, this.visible().length - 1)))
  readonly doneCount = computed(() => this.tasks().filter((t) => t.done).length)
  readonly allDone = computed(() => this.tasks().length > 0 && this.tasks().every((t) => t.done))

  constructor() {
    this.focus.enableTabCycling()
    inject(TuiKeyboard).onKey((key) => {
      const focused = this.focus.current()
      if (focused) {
        if (key.name === 'escape') focused.blur()
        return
      }
      const last = this.visible().length - 1
      if (key.name === 'up') this.selected.set(Math.max(0, this.cursor() - 1))
      if (key.name === 'down') this.selected.set(Math.min(last, this.cursor() + 1))
      if (key.name === 'space') this.toggle()
      if (key.name === 'q') process.exit(0)
    })
  }

  add(): void {
    const label = this.draft().trim()
    if (label) this.tasks.update((tasks) => [...tasks, { label, done: false }])
    this.draft.set('')
  }

  toggle(): void {
    const target = this.visible()[this.cursor()]
    if (!target) return
    this.tasks.update((tasks) => tasks.map((t) => (t === target ? { ...t, done: !t.done } : t)))
  }
}
