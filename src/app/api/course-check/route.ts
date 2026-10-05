// GET /api/course-check: the course's checkers ask here whether a learner's warm-ups 4 to 6 show on
// their site. It answers only yes/no and the clinic's public "What to bring" list, never a name or an
// e-mail address. The agreement with the checkers is docs/COURSE-CHECK-CONTRACT.md: do not change what
// this route answers, or the checkers stop working. The work is done in src/lib/courseCheckResponse.ts.
import { courseCheckResponse, methodNotAllowed } from '@/lib/courseCheckResponse'

// Read the database on every request, never once during the build: the answer must be the site as
// it is now.
export const dynamic = 'force-dynamic'

export function GET(request: Request): Promise<Response> {
  return courseCheckResponse(request)
}

/** The same status and headers as GET, without the body. */
export async function HEAD(request: Request): Promise<Response> {
  const response = await courseCheckResponse(request)
  return new Response(null, { status: response.status, headers: response.headers })
}

// Every other method answers 405. Next.js already answers 405 for a method a route does not export,
// except OPTIONS, which it would answer itself with 204: so each one is written out here.
export const POST = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
export const OPTIONS = methodNotAllowed
