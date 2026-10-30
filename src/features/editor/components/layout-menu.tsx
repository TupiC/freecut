import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { EditorPanelPosition } from '@/config/editor-workspaces'
import { useMaskEditorStore } from '@/features/editor/deps/preview'
import { useEditorStore } from '@/shared/state/editor'
import { cn } from '@/shared/ui/cn'

const POSITIONS: readonly EditorPanelPosition[] = ['bottom', 'right', 'top', 'left']
// Drop targets follow the visual grid so Tab moves top-to-bottom, left-to-right.
const GRID_POSITIONS: readonly EditorPanelPosition[] = ['top', 'left', 'right', 'bottom']
const DRAG_TYPE = 'application/x-freecut-layout-panel'

export function LayoutMenu() {
  const { t } = useTranslation()
  const workspace = useEditorStore((s) => s.workspace)
  const position = useEditorStore((s) => s.panelPosition)
  const setPosition = useEditorStore((s) => s.setPanelPosition)
  const setEditing = useEditorStore((s) => s.setLayoutEditing)
  const reset = useEditorStore((s) => s.resetPanelLayout)
  const maskEditing = useMaskEditorStore((s) => s.isEditing)
  const surface = t(workspace === 'color' ? 'toolbar.layout.grading' : 'toolbar.layout.timeline')
  // Radix restores focus to the trigger on close, which would steal it from the layout editor.
  const openingEditorRef = useRef(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={maskEditing}
          aria-label={t('toolbar.layout.label')}
          data-layout-trigger
          data-tooltip={t('toolbar.layout.label')}
          data-tooltip-side="bottom"
        >
          <LayoutDashboard className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (!openingEditorRef.current) return
          openingEditorRef.current = false
          event.preventDefault()
        }}
      >
        <DropdownMenuLabel>{t('toolbar.layout.position', { surface })}</DropdownMenuLabel>
        {POSITIONS.map((item) => (
          <DropdownMenuCheckboxItem
            key={item}
            checked={position === item}
            onSelect={() => setPosition(item)}
          >
            {t(`toolbar.layout.${item}`)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            openingEditorRef.current = true
            setEditing(true)
          }}
        >
          {t('toolbar.layout.edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={reset}>{t('toolbar.layout.reset')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A temporary, keyboard-operable drop map; the editor surfaces remain unobstructed outside edit mode. */
export function LayoutEditor() {
  const { t } = useTranslation()
  const editing = useEditorStore((s) => s.layoutEditing)
  const setEditing = useEditorStore((s) => s.setLayoutEditing)
  const position = useEditorStore((s) => s.panelPosition)
  const setPosition = useEditorStore((s) => s.setPanelPosition)
  const workspace = useEditorStore((s) => s.workspace)
  const surface = t(workspace === 'color' ? 'toolbar.layout.grading' : 'toolbar.layout.timeline')
  const activePositionRef = useRef<HTMLButtonElement>(null)
  const [dropTarget, setDropTarget] = useState<EditorPanelPosition | null>(null)

  useEffect(() => {
    if (!editing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Capture phase: close the editor without also clearing timeline selection.
      event.stopPropagation()
      setEditing(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    const focusFrame = requestAnimationFrame(() => activePositionRef.current?.focus())
    return () => {
      cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', onKeyDown, true)
      document.querySelector<HTMLButtonElement>('[data-layout-trigger]')?.focus()
    }
  }, [editing, setEditing])

  if (!editing) return null
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background/85 p-4"
      role="region"
      aria-label={t('toolbar.layout.edit')}
      // Keep editor hotkeys (Space, Delete, ...) away from the surfaces hidden behind the overlay.
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="text-center">
        <p className="text-sm font-semibold">{t('toolbar.layout.edit')}</p>
        <p className="text-xs text-muted-foreground">
          {t('toolbar.layout.instructions', { surface })}
        </p>
      </div>
      <div className="grid w-full max-w-md grid-cols-3 grid-rows-3 gap-1 text-center">
        {GRID_POSITIONS.map((item) => (
          <button
            key={item}
            ref={position === item ? activePositionRef : undefined}
            type="button"
            aria-pressed={position === item}
            onClick={() => setPosition(item)}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(DRAG_TYPE)) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              if (dropTarget !== item) setDropTarget(item)
            }}
            onDragLeave={() => setDropTarget((current) => (current === item ? null : current))}
            onDrop={(event) => {
              event.preventDefault()
              setDropTarget(null)
              if (event.dataTransfer.getData(DRAG_TYPE) === 'surface') setPosition(item)
            }}
            className={cn(
              'min-h-12 rounded border border-dashed p-2 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              position === item && 'border-primary bg-primary/10',
              dropTarget === item && 'border-solid border-primary bg-primary/20',
              item === 'top' && 'col-start-2 row-start-1',
              item === 'left' && 'col-start-1 row-start-2',
              item === 'right' && 'col-start-3 row-start-2',
              item === 'bottom' && 'col-start-2 row-start-3',
            )}
          >
            {t(`toolbar.layout.${item}`)}
          </button>
        ))}
        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(DRAG_TYPE, 'surface')
            event.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => setDropTarget(null)}
          className="col-start-2 row-start-2 flex min-h-16 cursor-grab items-center justify-center gap-1 rounded border bg-muted p-2 text-xs font-medium active:cursor-grabbing"
        >
          <Move className="h-4 w-4" />
          {surface}
        </div>
      </div>
      <Button size="sm" onClick={() => setEditing(false)}>
        {t('common.done')}
      </Button>
    </div>
  )
}
