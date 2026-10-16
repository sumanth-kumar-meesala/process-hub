import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Material 3 button styles (filled / tonal / outlined / text / icon) in shadcn's shape
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        filled: 'bg-primary text-on-primary hover:bg-[#1a44c0] shadow-sm',
        tonal: 'bg-surface-low text-on-surface hover:bg-surface-mid',
        outlined: 'border border-outline-variant bg-white text-on-surface hover:bg-surface-low',
        text: 'text-primary hover:bg-primary-container/60',
        dark: 'bg-on-surface text-white hover:bg-black',
        danger: 'text-error hover:bg-error-container',
        icon: 'text-on-surface-variant hover:bg-surface-mid',
      },
      size: { sm: 'h-9 px-3.5 text-[13px]', md: 'h-11 px-5 text-sm', lg: 'h-12 px-6 text-[15px]', icon: 'h-10 w-10', iconLg: 'h-11 w-11' },
    },
    defaultVariants: { variant: 'filled', size: 'md' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'
