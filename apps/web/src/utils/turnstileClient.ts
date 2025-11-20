interface TurnstileGlobal {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'error-callback'?: () => void
      'timeout-callback'?: () => void
    }
  ) => string | undefined
  reset?: (widgetId?: string) => void
}

interface TurnstileWindow extends Window {
  turnstile?: TurnstileGlobal
}

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_ATTRIBUTE = 'data-turnstile'

let loadPromise: Promise<void> | null = null

const loadTurnstileScript = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile script can only be loaded in a browser context.'))
  }

  const turnstileWindow = window as TurnstileWindow
  if (turnstileWindow.turnstile) {
    return Promise.resolve()
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(`script[${SCRIPT_ATTRIBUTE}="true"]`)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.defer = true
    script.setAttribute(SCRIPT_ATTRIBUTE, 'true')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script failed to load.'))
    document.head.appendChild(script)
  })

  return loadPromise
}

export interface TurnstileController {
  getToken: () => string
  reset: () => void
}

export interface MountTurnstileOptions {
  container: HTMLElement
  siteKey: string
  onToken: (token: string) => void
  onError?: () => void
  onTimeout?: () => void
}

export const mountTurnstileWidget = async ({
  container,
  siteKey,
  onToken,
  onError,
  onTimeout,
}: MountTurnstileOptions): Promise<TurnstileController> => {
  if (!container) {
    throw new Error('Turnstile container element is required.')
  }
  if (!siteKey) {
    throw new Error('Turnstile site key is required.')
  }

  await loadTurnstileScript()

  const turnstileWindow = window as TurnstileWindow
  const turnstile = turnstileWindow.turnstile

  if (!turnstile) {
    throw new Error('Turnstile global object is unavailable after script load.')
  }

  let token = ''
  const widgetId = turnstile.render(container, {
    sitekey: siteKey,
    callback: (value: string) => {
      token = value
      onToken(value)
    },
    'error-callback': () => {
      token = ''
      onError?.()
    },
    'timeout-callback': () => {
      token = ''
      onTimeout?.()
    },
  })

  const reset = () => {
    token = ''
    turnstile.reset?.(widgetId)
  }

  return {
    getToken: () => token,
    reset,
  }
}

export { TURNSTILE_SCRIPT_URL }
