import { ApiError } from './api'

/** Turns any thrown error into a message that's fine to show the user. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR') return 'Please check the details you entered.'
    return error.message
  }
  return 'Something went wrong. Please try again.'
}
