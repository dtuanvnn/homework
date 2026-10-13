import { useRef } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { uid } from '@/lib/questions'
import type { Attachment } from '@/lib/types'

interface AttachmentGalleryProps {
  attachments: Attachment[]
  /** Without it the files are read-only (no remove buttons). */
  onChange?: (attachments: Attachment[]) => void
  /** Show the trailing "Thêm tệp" tile (default true). */
  showAdd?: boolean
}

/** Converts picked/dropped files into attachments (images get a local preview URL). */
export function filesToAttachments(files: FileList | File[]): Attachment[] {
  return Array.from(files)
    .filter((file) => file.type === 'application/pdf' || file.type.startsWith('image/'))
    .map((file) => {
      const isPdf = file.type === 'application/pdf'
      return {
        id: uid('tep'),
        name: file.name,
        kind: isPdf ? 'pdf' : 'image',
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        url: isPdf ? undefined : URL.createObjectURL(file),
        file,
      }
    })
}

function formatSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB` : `${kb} KB`
}

export default function AttachmentGallery({ attachments, onChange, showAdd = true }: AttachmentGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return
    onChange?.([...attachments, ...filesToAttachments(files)])
  }

  return (
    <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pt-1 pb-1">
      {attachments.map((file) => (
        <figure key={file.id} className="group relative w-28 shrink-0">
          <div className="aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-xs">
            {file.kind === 'image' && file.url ? (
              <img src={file.url} alt={`Ảnh quét: ${file.name}`} className="size-full object-cover" />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 bg-red-50 text-red-600">
                <FileText className="size-9" strokeWidth={1.5} />
                <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">PDF</span>
                {file.pages && <span className="text-xs text-red-700/80">{file.pages} trang</span>}
              </div>
            )}
          </div>
          <figcaption className="mt-1.5">
            <div className="truncate text-xs font-medium text-slate-700" title={file.name}>
              {file.name}
            </div>
            <div className="text-[11px] text-slate-400">{formatSize(file.sizeKb)}</div>
          </figcaption>
          {onChange && (
            <button
              type="button"
              onClick={() => onChange(attachments.filter((a) => a.id !== file.id))}
              className="absolute -top-2 -right-2 flex size-9 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label={`Gỡ tệp ${file.name}`}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-900/80 text-white shadow">
                <X className="size-3.5" />
              </span>
            </button>
          )}
        </figure>
      ))}

      {showAdd && (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-[3/4] w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 transition-colors outline-none hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-slate-100">
          <Plus className="size-5" />
        </span>
        <span className="text-xs font-semibold">Thêm tệp</span>
        <span className="text-[10px] text-slate-400">Ảnh hoặc PDF</span>
      </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
