import '@angular/compiler'
import {
  type ApplicationRef,
  DOCUMENT,
  type ComponentRef,
  type EnvironmentProviders,
  ErrorHandler,
  type Provider,
  RendererFactory2,
  type Type,
  createComponent,
  provideZonelessChangeDetection,
  ɵIMAGE_CONFIG as IMAGE_CONFIG,
  ɵINJECTOR_SCOPE as INJECTOR_SCOPE,
  ɵinternalCreateApplication as internalCreateApplication,
} from '@angular/core'
import { CliRenderer, type CliRendererConfig, createCliRenderer } from '@opentui/core'
import { TuiRendererFactory } from './renderer'

export interface TuiBootstrapOptions {
  renderer?: CliRenderer
  rendererConfig?: CliRendererConfig
  providers?: (Provider | EnvironmentProviders)[]
}

export interface TuiApplication<T> {
  appRef: ApplicationRef
  componentRef: ComponentRef<T>
  renderer: CliRenderer
  destroy(): void
}

// Restores the terminal before reporting: an error printed while the
// alternate screen is active disappears when the screen is wiped.
class TuiErrorHandler implements ErrorHandler {
  constructor(private readonly renderer: CliRenderer) {}

  handleError(error: unknown): void {
    this.renderer.destroy()
    console.error(error)
    process.exitCode = 1
  }
}

// OpenTUI installs a global requestAnimationFrame that fires inside its
// render loop — synchronously when a live render is requested. Angular's
// zoneless scheduler races rAF against setTimeout and must never tick
// synchronously (notification phase) or mid-render-pass (renders get
// dropped). Deferring rAF callbacks by one microtask keeps OpenTUI's frame
// timing while making the callback safely asynchronous.
function deferAnimationFrameCallbacks(): void {
  const raf = globalThis.requestAnimationFrame as
    | (typeof globalThis.requestAnimationFrame & { __ngxOpentuiDeferred?: boolean })
    | undefined
  if (!raf || raf.__ngxOpentuiDeferred) return
  const wrapped = ((callback: FrameRequestCallback) =>
    raf((time) => {
      queueMicrotask(() => callback(time))
    })) as typeof globalThis.requestAnimationFrame & { __ngxOpentuiDeferred?: boolean }
  wrapped.__ngxOpentuiDeferred = true
  globalThis.requestAnimationFrame = wrapped
}

export async function bootstrapTuiApplication<T>(
  rootComponent: Type<T>,
  options: TuiBootstrapOptions = {},
): Promise<TuiApplication<T>> {
  const renderer = options.renderer ?? (await createCliRenderer(options.rendererConfig ?? {}))
  const ownsRenderer = !options.renderer
  deferAnimationFrameCallbacks()
  try {
    const appRef: ApplicationRef = await internalCreateApplication({
      appProviders: [
        // platform-browser normally marks the app injector as root scope;
        // without it, no providedIn:'root' token (AppId, error handler,
        // TuiKeyboard, ...) can resolve.
        { provide: INJECTOR_SCOPE, useValue: 'root' },
        // Bun defines PerformanceObserver, so Angular's dev-mode image
        // scanner would start and demand a document. No images in a terminal.
        { provide: IMAGE_CONFIG, useValue: { disableImageSizeWarning: true, disableImageLazyLoadWarning: true } },
        // createComponent resolves a style host from document.head even for
        // style-less components; the head is never touched when no component
        // declares styles (which none can, in a terminal).
        { provide: DOCUMENT, useValue: { head: null } },
        provideZonelessChangeDetection(),
        { provide: CliRenderer, useValue: renderer },
        { provide: RendererFactory2, useValue: new TuiRendererFactory(renderer) },
        { provide: ErrorHandler, useValue: new TuiErrorHandler(renderer) },
        ...(options.providers ?? []),
      ],
    })
    const componentRef = createComponent(rootComponent, {
      environmentInjector: appRef.injector,
      hostElement: renderer.root as unknown as Element,
    })
    appRef.attachView(componentRef.hostView)
    componentRef.changeDetectorRef.detectChanges()
    return {
      appRef,
      componentRef,
      renderer,
      destroy(): void {
        appRef.destroy()
        if (ownsRenderer) renderer.destroy()
      },
    }
  } catch (error) {
    if (ownsRenderer) renderer.destroy()
    throw error
  }
}
