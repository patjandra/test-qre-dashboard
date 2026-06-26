/// <reference types="vite/client" />
import type { RendererApi } from '@shared/ipc'
import type { JSX as ReactJSX } from 'react'

declare global {
  interface Window {
    api: RendererApi
  }

  // React 19 moved JSX under the React namespace; re-expose Element globally so
  // component return-type annotations (`: JSX.Element`) keep resolving.
  namespace JSX {
    type Element = ReactJSX.Element
  }
}

export {}
