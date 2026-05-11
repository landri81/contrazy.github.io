type SearchParamsReader = {
  get(name: string): string | null
  toString(): string
}

export const VENDOR_ACTIONS_CREATE_LINK_PARAM = "compose"
export const VENDOR_ACTIONS_CREATE_LINK_VALUE = "create-link"

export function getVendorActionsCreateLinkHref(basePath: string = "/vendor/actions") {
  return `${basePath}?${VENDOR_ACTIONS_CREATE_LINK_PARAM}=${VENDOR_ACTIONS_CREATE_LINK_VALUE}`
}

export function hasVendorActionsCreateLinkCompose(
  searchParams: SearchParamsReader | null | undefined
) {
  return searchParams?.get(VENDOR_ACTIONS_CREATE_LINK_PARAM) === VENDOR_ACTIONS_CREATE_LINK_VALUE
}

export function buildVendorActionsCreateLinkPath(
  pathname: string,
  searchParams: SearchParamsReader | null | undefined,
  open: boolean
) {
  const params = new URLSearchParams(searchParams?.toString() ?? "")

  if (open) {
    params.set(VENDOR_ACTIONS_CREATE_LINK_PARAM, VENDOR_ACTIONS_CREATE_LINK_VALUE)
  } else {
    params.delete(VENDOR_ACTIONS_CREATE_LINK_PARAM)
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
