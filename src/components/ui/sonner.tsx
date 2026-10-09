import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'rounded-2xl! border-slate-200! font-sans! shadow-lg!',
          title: 'font-semibold!',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
