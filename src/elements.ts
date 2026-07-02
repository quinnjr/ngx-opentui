import {
  ASCIIFontRenderable,
  BoxRenderable,
  InputRenderable,
  type Renderable,
  type RenderContext,
  ScrollBoxRenderable,
  SelectRenderable,
  TextRenderable,
} from '@opentui/core'

export type RenderableCtor = new (ctx: RenderContext, options: Record<string, unknown>) => Renderable

export const ELEMENTS: Record<string, RenderableCtor> = {
  'box': BoxRenderable,
  'text': TextRenderable,
  'input': InputRenderable,
  'select': SelectRenderable,
  'scrollbox': ScrollBoxRenderable,
  'ascii-font': ASCIIFontRenderable,
}
