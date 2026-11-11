import { proxyOwm } from '../../../server/owmProxy'

interface Env {
  OWM_API_KEY?: string
}

interface Context {
  request: Request
  env: Env
  params: { path?: string | string[] }
}

// Cloudflare Pages Function for /api/owm/*.
export const onRequest = ({ request, env, params }: Context): Promise<Response> => {
  const segments = Array.isArray(params.path) ? params.path : params.path ? [params.path] : []
  return proxyOwm(request, segments.join('/'), env.OWM_API_KEY)
}
