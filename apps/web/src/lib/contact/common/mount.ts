import { type TurnstileController, mountTurnstileWidget } from '@utils/turnstileClient'
import {
  type ContactFormMetadata,
  type ContactSubmissionPayload,
  buildSubmissionValues,
  fetchContactFormMetadata,
  submitContactForm,
} from './api'
import { type ContactFieldDefinition, buildOptionLabelMap } from './definitions'

const isString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

const showResponseMessage = (element: HTMLElement, message: string, type: 'success' | 'error' | 'info') => {
  element.textContent = message
  switch (type) {
    case 'success':
      element.className = 'text-green-500'
      break
    case 'error':
      element.className = 'text-red-500'
      break
    case 'info':
      element.className = 'text-blue-500'
      break
  }
}

const createInputGroup = (field: ContactFieldDefinition, formId: string) => {
  const wrapper = document.createElement('div')
  wrapper.className = 'space-y-2'

  const label = document.createElement('label')
  label.className = 'block text-sm font-medium text-gray-700'
  label.htmlFor = `${formId}-${field.slug}`
  label.textContent = field.label + ((field.required ?? false) ? ' *' : '')
  wrapper.appendChild(label)

  if (field.helpText) {
    const help = document.createElement('p')
    help.className = 'text-xs text-gray-500'
    help.textContent = field.helpText
    wrapper.appendChild(help)
  }

  const addRequired = <T extends HTMLElement>(input: T) => {
    if (field.required) {
      input.setAttribute('required', 'true')
    }
    return input
  }

  const sanitizePlaceholder = (value: unknown) => (isString(value) ? value : undefined)

  switch (field.type) {
    case 'TEXT':
    case 'EMAIL':
    case 'TEL':
    case 'NUMBER':
    case 'DATE': {
      const input = document.createElement('input')
      input.id = `${formId}-${field.slug}`
      input.name = field.slug
      input.type = field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'
      if (field.type === 'EMAIL') input.type = 'email'
      if (field.type === 'TEL') input.type = 'tel'
      input.className =
        'w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500'
      const placeholder = sanitizePlaceholder(field.placeholder)
      if (placeholder) input.placeholder = placeholder
      wrapper.appendChild(addRequired(input))
      break
    }
    case 'TEXTAREA': {
      const textarea = document.createElement('textarea')
      textarea.id = `${formId}-${field.slug}`
      textarea.name = field.slug
      textarea.rows = 4
      textarea.className =
        'w-full resize-y rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500'
      wrapper.appendChild(addRequired(textarea))
      break
    }
    case 'SELECT': {
      const select = document.createElement('select')
      select.id = `${formId}-${field.slug}`
      select.name = field.slug
      select.className =
        'w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500'
      if (!field.options?.length) {
        const option = document.createElement('option')
        option.value = ''
        option.textContent = '選択肢が設定されていません'
        select.appendChild(option)
        select.disabled = true
      } else {
        const placeholder = document.createElement('option')
        placeholder.value = ''
        placeholder.textContent = field.required ? '選択してください' : '未選択'
        select.appendChild(placeholder)
        field.options.forEach(({ value, label }) => {
          const option = document.createElement('option')
          option.value = value
          option.textContent = label || value
          select.appendChild(option)
        })
      }
      wrapper.appendChild(addRequired(select))
      break
    }
    case 'RADIO':
    case 'CHECKBOX': {
      if (!field.options?.length) {
        const notice = document.createElement('p')
        notice.className = 'text-sm text-red-500'
        notice.textContent = '選択肢が設定されていません'
        wrapper.appendChild(notice)
        break
      }
      const group = document.createElement('div')
      group.className = 'space-y-2'
      field.options.forEach((option, index) => {
        const optionWrapper = document.createElement('div')
        optionWrapper.className = 'flex items-center space-x-2'
        const input = document.createElement('input')
        input.type = field.type === 'RADIO' ? 'radio' : 'checkbox'
        input.name = field.slug
        input.value = option.value
        input.id = `${formId}-${field.slug}-${index}`
        if (field.type === 'RADIO' && field.required && index === 0) {
          input.setAttribute('required', 'true')
        }

        const optionLabel = document.createElement('label')
        optionLabel.htmlFor = input.id
        optionLabel.className = 'text-sm text-gray-700'
        optionLabel.textContent = option.label || option.value
        optionWrapper.appendChild(input)
        optionWrapper.appendChild(optionLabel)
        group.appendChild(optionWrapper)
      })
      wrapper.appendChild(group)
      break
    }
    default: {
      const input = document.createElement('input')
      input.id = `${formId}-${field.slug}`
      input.name = field.slug
      input.type = 'text'
      input.className =
        'w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500'
      wrapper.appendChild(addRequired(input))
      break
    }
  }

  return wrapper
}

const bootstrapContactForm = async () => {
  let formMetadata: ContactFormMetadata | null = null
  let turnstileControllerInput: TurnstileController | null = null
  let currentValues: Record<string, unknown> = {}

  const responseMessageInput = getRequiredElement('#response-message-input', HTMLElement)
  const responseMessageConfirm = getRequiredElement('#response-message-confirm', HTMLElement)
  const inputScreen = getRequiredElement('#input-screen', HTMLElement)
  const confirmScreen = getRequiredElement('#confirm-screen', HTMLElement)
  const completeScreen = getRequiredElement('#complete-screen', HTMLElement)
  const confirmList = getRequiredElement('#confirm-list', HTMLElement)
  const backToInputButton = getRequiredElement('#back-to-input', HTMLElement)
  const submitButton = getRequiredElement('#submit-button', HTMLButtonElement)

  const showScreen = (screen: 'input' | 'confirm' | 'complete') => {
    inputScreen.classList.add('hidden')
    confirmScreen.classList.add('hidden')
    completeScreen.classList.add('hidden')
    switch (screen) {
      case 'input':
        inputScreen.classList.remove('hidden')
        break
      case 'confirm':
        confirmScreen.classList.remove('hidden')
        break
      case 'complete':
        completeScreen.classList.remove('hidden')
        break
    }
  }

  const resetTurnstileInput = () => {
    const tokenInput = document.getElementById('turnstile-token-input') as HTMLInputElement
    if (tokenInput) tokenInput.value = ''
    turnstileControllerInput?.reset()
  }

  const isNetworkError = (error: unknown) => {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return true
    }
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      return true
    }
    return false
  }

  const buildFallbackApiBase = () => {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const fallback = new URL('/app/api', window.location.origin)
      return fallback.toString().replace(/\/$/, '')
    } catch (error) {
      console.warn('Fallback API URL の生成に失敗しました:', error)
      return null
    }
  }

  const fetchFormMetadataWithFallback = async (slug: string): Promise<ContactFormMetadata> => {
    try {
      return await fetchContactFormMetadata(slug)
    } catch (primaryError) {
      if (!isNetworkError(primaryError)) {
        throw primaryError
      }

      const fallbackBase = buildFallbackApiBase()
      if (!fallbackBase) {
        throw primaryError
      }

      try {
        const response = await fetch(`${fallbackBase}/contact/forms/public/${slug}`)
        if (!response.ok) {
          throw new Error(`フォーム情報の取得に失敗しました (${response.status})`)
        }
        return (await response.json()) as ContactFormMetadata
      } catch (fallbackError) {
        console.error('フォーム定義のフェッチに失敗しました (fallback 経路):', fallbackError)
        throw primaryError
      }
    }
  }

  const submitContactFormWithFallback = async (payload: ContactSubmissionPayload) => {
    try {
      return await submitContactForm(payload)
    } catch (primaryError) {
      if (!isNetworkError(primaryError)) {
        throw primaryError
      }

      const fallbackBase = buildFallbackApiBase()
      if (!fallbackBase) {
        throw primaryError
      }

      try {
        const response = await fetch(`${fallbackBase}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })

        const result = await response.json().catch(() => ({ message: 'Unexpected error' }))
        if (!response.ok) {
          const message = result?.message ?? `送信に失敗しました (${response.status})`
          throw new Error(message)
        }
        return result as { successMessage?: string | null; message?: string | null }
      } catch (fallbackError) {
        console.error('フォーム送信に失敗しました (fallback 経路):', fallbackError)
        throw primaryError
      }
    }
  }

  try {
    const formInput = getRequiredElement('#contact-form-input', HTMLFormElement)
    const fieldsContainer = getRequiredElement('#dynamic-fields', HTMLElement)
    const turnstileTokenInput = getRequiredElement('#turnstile-token-input', HTMLInputElement)
    const turnstileContainerInput = getRequiredElement('#turnstile-container-input', HTMLElement)
    const formSlug = formInput.dataset.formSlug ?? 'inquiry'

    const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY
    if (!isString(siteKey)) {
      showResponseMessage(responseMessageInput, 'Turnstileのサイトキーが設定されていません。', 'error')
      return
    }

    try {
      formMetadata = await fetchFormMetadataWithFallback(formSlug)
    } catch (error) {
      console.error('フォーム定義の取得に失敗しました:', error)
      const message = error instanceof Error ? error.message : 'フォーム情報の取得に失敗しました。'
      showResponseMessage(responseMessageInput, message, 'error')
      return
    }

    const definitionFields = formMetadata?.fields ?? []
    if (definitionFields.length === 0) {
      showResponseMessage(responseMessageInput, 'フォーム項目が定義されていません。', 'error')
      return
    }

    const sortedFields = [...definitionFields].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.slug.localeCompare(b.slug)
    )

    const optionLabels = buildOptionLabelMap(sortedFields)

    fieldsContainer.innerHTML = ''
    sortedFields.forEach((field) => {
      const group = createInputGroup(field, 'contact-form-input')
      fieldsContainer.appendChild(group)
    })

    if (formMetadata?.turnstileEnabled) {
      turnstileControllerInput = await mountTurnstileWidget({
        container: turnstileContainerInput,
        siteKey,
        onToken: (token) => {
          turnstileTokenInput.value = token
        },
        onError: () => {
          resetTurnstileInput()
          showResponseMessage(responseMessageInput, 'Turnstile検証に失敗しました。再読み込みしてください。', 'error')
        },
        onTimeout: () => {
          resetTurnstileInput()
        },
      })
    }

    formInput.addEventListener('submit', async (event) => {
      event.preventDefault()
      showResponseMessage(responseMessageInput, '', 'info')

      const formData = new FormData(formInput)
      const collectedValues = buildSubmissionValues(sortedFields, formData)

      for (const field of sortedFields) {
        if (field.required && !Object.hasOwn(collectedValues, field.slug)) {
          showResponseMessage(responseMessageInput, `${field.label} は必須です。`, 'error')
          return
        }
      }

      const turnstileToken = turnstileTokenInput.value
      if (formMetadata?.turnstileEnabled && !turnstileToken) {
        showResponseMessage(responseMessageInput, 'セキュリティ検証が完了していません。', 'error')
        return
      }

      currentValues = collectedValues
      confirmList.innerHTML = ''
      for (const field of sortedFields) {
        const dt = document.createElement('dt')
        dt.className = 'font-semibold'
        dt.textContent = field.label
        const dd = document.createElement('dd')
        dd.className = 'mt-1'
        const value = collectedValues[field.slug]
        if (Array.isArray(value)) {
          const mapped = value
            .map((item) =>
              typeof item === 'string' && optionLabels[field.slug] ? (optionLabels[field.slug][item] ?? item) : item
            )
            .filter((item) => item !== undefined && item !== null && item !== '')
          dd.textContent = mapped.length > 0 ? mapped.join(', ') : '未入力'
        } else if (typeof value === 'string' && optionLabels[field.slug]) {
          dd.textContent = optionLabels[field.slug][value] ?? value ?? '未入力'
        } else {
          dd.textContent = (value as string) || '未入力'
        }
        confirmList.appendChild(dt)
        confirmList.appendChild(dd)
      }

      submitButton.disabled = false
      showScreen('confirm')
    })

    backToInputButton.addEventListener('click', () => {
      showScreen('input')
    })

    submitButton.addEventListener('click', async () => {
      submitButton.disabled = true
      submitButton.textContent = '送信中...'
      showResponseMessage(responseMessageConfirm, '', 'info')

      const token = turnstileTokenInput.value
      if (formMetadata?.turnstileEnabled && !token) {
        showResponseMessage(responseMessageConfirm, 'セキュリティ検証が完了していません。', 'error')
        submitButton.disabled = false
        submitButton.textContent = '送信する'
        resetTurnstileInput()
        return
      }

      try {
        const payload: ContactSubmissionPayload = {
          formSlug: formMetadata?.slug ?? formSlug,
          values: currentValues,
          turnstileToken: token,
        }
        const result = await submitContactFormWithFallback(payload)

        const successMessageElement = document.getElementById('success-message') as HTMLElement
        if (successMessageElement) {
          successMessageElement.textContent =
            result.successMessage || formMetadata?.successMessage || 'お問い合わせありがとうございます。'
        }
        resetTurnstileInput()
        showScreen('complete')
      } catch (error) {
        console.error('送信中にエラーが発生しました:', error)
        const message =
          error instanceof Error ? error.message : 'エラーが発生しました。しばらくしてから再度お試しください。'
        showResponseMessage(responseMessageConfirm, message, 'error')
        if (message.includes('Turnstile') || message.includes('Forbidden')) {
          resetTurnstileInput()
        }
      } finally {
        submitButton.disabled = false
        submitButton.textContent = '送信する'
      }
    })
  } catch (error) {
    console.error('初期化エラー:', error)
    const message = error instanceof Error ? error.message : 'ページの初期化に失敗しました。'
    showResponseMessage(responseMessageInput, message, 'error')
  }
}

let isMounted = false

export const mountContactFormPage = () => {
  if (isMounted) {
    return
  }
  isMounted = true

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void bootstrapContactForm()
    })
  } else {
    void bootstrapContactForm()
  }
}

export default mountContactFormPage

type ElementConstructor<T extends HTMLElement> = { new (...args: unknown[]): T }

function getRequiredElement<T extends HTMLElement>(selector: string, type: ElementConstructor<T>): T {
  const element = document.querySelector(selector)
  if (!element || !(element instanceof type)) {
    throw new Error(`必須要素が見つかりません: ${selector}`)
  }
  return element
}
