import { DOMParser as XmldomParser } from '@xmldom/xmldom'

type GlobalWithDomParser = typeof globalThis & {
  DOMParser?: typeof XmldomParser
}

const globalObject = globalThis as GlobalWithDomParser

if (typeof globalObject.DOMParser === 'undefined') {
  globalObject.DOMParser = XmldomParser
}
