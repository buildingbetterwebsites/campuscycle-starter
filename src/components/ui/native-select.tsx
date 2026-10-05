// A drop-down list, from shadcn/ui (npx shadcn add native-select), restyled with the site's tokens.
// It is the browser's own <select>, so it works without JavaScript, with the keyboard, and with the
// phone's own picker. (shadcn's other "select" needs JavaScript, so this starter does not use it.)
import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDownIcon } from 'lucide-react'
import { fieldClasses } from './input'

function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative w-full has-[select:disabled]:opacity-60" data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(fieldClasses, 'h-11 cursor-pointer appearance-none py-2 pr-10', className)}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption(props: React.ComponentProps<'option'>) {
  return <option data-slot="native-select-option" {...props} />
}

function NativeSelectOptGroup(props: React.ComponentProps<'optgroup'>) {
  return <optgroup data-slot="native-select-optgroup" {...props} />
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
