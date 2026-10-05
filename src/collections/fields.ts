// Fields that several collections share. Writing them once here means a change (for example a better
// description) reaches every collection that uses the field, and they can never drift apart.
import type { Field, NumberFieldSingleValidation, TextFieldSingleValidation } from 'payload'
import { text } from 'payload/shared'

// Lowercase letters and digits, in groups joined by single hyphens: "repair-a-puncture", "gears-2".
export const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/

const slugFormat: TextFieldSingleValidation = (value, options) => {
  if (value && !SLUG_FORMAT.test(value)) {
    return 'Use only lowercase letters, digits and hyphens, for example repair-a-puncture.'
  }
  // Payload's own text check still runs, so an empty slug still gets the usual "required" message.
  return text(value, options)
}

// The slug becomes part of a web address, so it must be unique and safe to put in a link.
export const slug: Field = {
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  validate: slugFormat,
  admin: {
    description: 'The last part of the web address, for example repair-a-puncture. Use lowercase letters, digits and hyphens.',
  },
}

export const day: Field = {
  name: 'day',
  type: 'select',
  required: true,
  options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
}

export const startTime: Field = {
  name: 'startTime',
  type: 'text',
  required: true,
  admin: {
    description: 'Use the 24-hour clock, for example 18:30.',
  },
}

export const price: Field = {
  name: 'price',
  type: 'number',
  required: true,
  min: 0,
}

// Places and group sizes count people or bicycles, so 1.5 or 0 makes no sense.
export const positiveInteger: NumberFieldSingleValidation = (value) => {
  if (Number.isInteger(value) && Number(value) > 0) {
    return true
  }
  return 'Enter a whole number of at least 1.'
}
