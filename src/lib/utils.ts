// shadcn/ui's parts import cn from here (components.json, "utils": "@/lib/utils"), so a part added later
// with `npx shadcn add` compiles as it is. cn joins class names and lets a later Tailwind class win.
export { cn } from 'cn'
