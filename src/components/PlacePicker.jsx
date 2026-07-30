import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { marinas } from '../data'

// The list spans working harbors, open anchorages, and lighthouses you'd only
// stand off and look at. Grouping keeps a 50-entry list scannable and warns
// the helm that picking "Greens Ledge Light" is not picking a place to tie up.
const PLACE_GROUPS = [
  { label: 'Marinas & Harbors', match: (m) => !m.kind || m.kind === 'marina' },
  { label: 'Anchorages & Beaches', match: (m) => m.kind === 'anchorage' },
  { label: 'Lighthouses & Landmarks', match: (m) => m.kind === 'landmark' },
]

// Chart names carry apostrophes and punctuation a helm typing one-handed at
// 22 kts will not reproduce — "Tod's Point" has to come back for "tods".
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '')
}

// Every term has to hit somewhere in the name, in any order, so "norwalk ct"
// and "ct norwalk" both find the same harbor.
function matchesQuery(place, terms) {
  if (terms.length === 0) return true
  const haystack = normalize(place.name)
  return terms.every((term) => haystack.includes(term))
}

// Room to leave under the list: the mobile tab bar floats over the sheet, and
// anything the list paints behind it can't be tapped.
const BOTTOM_CHROME_PX = 80
// Same idea at the top of the screen — the notch, and the brand badge floating
// over the mobile chart.
const TOP_CHROME_PX = 56
const MIN_LIST_PX = 132
const MAX_LIST_PX = 260
const LIST_GAP_PX = 4

// The list is rendered into document.body instead of alongside the field.
//
// On mobile the field lives in the bottom sheet's scroll box, which clips
// anything positioned out of it: options placed above the field paint behind the
// sheet and the map, where a tap lands on the chart instead of the harbor. Fixed
// to the viewport, the list can use the whole screen between the two chrome
// margins above — measured here, since the field itself may only have an inch of
// unclipped room around it.
function measurePlacement(field, side) {
  const rect = field.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - BOTTOM_CHROME_PX
  const above = rect.top - TOP_CHROME_PX
  const useAbove = side ?? (below < MIN_LIST_PX && above > below)
  const room = Math.max(useAbove ? above : below, 0)
  return {
    above: useAbove,
    left: Math.round(rect.left),
    width: Math.round(rect.width),
    top: useAbove ? undefined : Math.round(rect.bottom + LIST_GAP_PX),
    bottom: useAbove ? Math.round(window.innerHeight - rect.top + LIST_GAP_PX) : undefined,
    maxHeight: Math.max(MIN_LIST_PX, Math.min(MAX_LIST_PX, room)),
  }
}

const SEARCH_ICON = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
)

const CLEAR_ICON = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
)

export default function PlacePicker({ label, labelIcon, value, onChange, placeholder }) {
  // `query` is null while the field is just displaying the current selection —
  // that's what lets a focused field show the whole list before anything is
  // typed, instead of filtering against the name already in the box.
  const [query, setQuery] = useState(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [placement, setPlacement] = useState(null)
  const wrapRef = useRef(null)
  const fieldRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  const selected = marinas.find((m) => m.id === value)
  const terms = useMemo(
    () => normalize(query ?? '').split(/\s+/).filter(Boolean),
    [query],
  )

  // Groups keep their data.js order, which runs roughly west to east along the
  // Sound — a geographic ordering worth preserving in the results.
  const groups = useMemo(() => (
    PLACE_GROUPS
      .map(({ label: groupLabel, match }) => ({
        label: groupLabel,
        places: marinas.filter((m) => match(m) && matchesQuery(m, terms)),
      }))
      .filter((group) => group.places.length > 0)
  ), [terms])

  const flatPlaces = useMemo(() => groups.flatMap((g) => g.places), [groups])

  // Reopening on a fresh query should land the highlight on the current
  // selection when it survived the filter, so Enter is a no-op rather than a
  // surprise reroute.
  useEffect(() => {
    if (!open) return
    const selectedIndex = flatPlaces.findIndex((p) => p.id === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : (flatPlaces.length > 0 ? 0 : -1))
  }, [open, flatPlaces, value])

  // In the mobile bottom sheet the field can sit low enough that a downward list
  // runs under the tab bar, so flip it above the input when there is more room up
  // there. Measured before paint to avoid a visible jump.
  useLayoutEffect(() => {
    if (!open || !fieldRef.current) return
    // Which side the list opens on is settled once per open. Re-deciding it
    // while the sheet scrolls under the list would flip it past the finger
    // mid-gesture; only the anchor moves after that.
    let side = null
    const update = () => {
      if (!fieldRef.current) return
      const next = measurePlacement(fieldRef.current, side)
      side = next.above
      setPlacement(next)
    }
    update()
    // A fixed list is pinned to the viewport, but the field it points at rides
    // the sheet's scroll box — hence the capture phase, which catches scrolls on
    // that box rather than only on the window.
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, groups])

  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return
    const option = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
    if (option) option.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      // The list is portaled out of the wrapper, so it has to be asked
      // separately — otherwise pressing an option reads as an outside press and
      // closes the list before the click can land on it.
      if (wrapRef.current?.contains(event.target)) return
      if (listRef.current?.contains(event.target)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function close() {
    setOpen(false)
    setQuery(null)
  }

  function select(place) {
    onChange(place.id)
    setOpen(false)
    setQuery(null)
    inputRef.current?.blur()
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (flatPlaces.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((i) => (i + step + flatPlaces.length) % flatPlaces.length)
    } else if (event.key === 'Enter') {
      if (open && activeIndex >= 0 && flatPlaces[activeIndex]) {
        event.preventDefault()
        select(flatPlaces[activeIndex])
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        close()
      }
    } else if (event.key === 'Tab') {
      close()
    }
  }

  const inputValue = query ?? selected?.name ?? ''

  return (
    <div className="place-picker" ref={wrapRef}>
      <label className="place-picker-label" htmlFor={`${listId}-input`}>
        <span className="label-icon">{labelIcon}</span>
        {label}
      </label>
      <div className="place-picker-field" ref={fieldRef}>
        <span className="place-picker-search-icon">{SEARCH_ICON}</span>
        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={(e) => { setOpen(true); e.target.select() }}
          onKeyDown={handleKeyDown}
        />
        {selected && (
          <button
            type="button"
            className="place-picker-clear"
            aria-label={`Clear ${label.toLowerCase()}`}
            // Without this the input loses focus before the click lands and
            // the outside-pointerdown handler closes the list first.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(''); setQuery(''); setOpen(true); inputRef.current?.focus() }}
          >
            {CLEAR_ICON}
          </button>
        )}
      </div>

      {open && placement && createPortal(
        <div
          className="place-picker-list"
          style={{
            left: `${placement.left}px`,
            width: `${placement.width}px`,
            top: placement.top != null ? `${placement.top}px` : undefined,
            bottom: placement.bottom != null ? `${placement.bottom}px` : undefined,
            maxHeight: `${placement.maxHeight}px`,
          }}
          ref={listRef}
          id={listId}
          role="listbox"
        >
          {flatPlaces.length === 0 && (
            <p className="place-picker-empty">No places match “{query}”.</p>
          )}
          {groups.map((group) => (
            <div key={group.label} role="group" aria-label={group.label}>
              <p className="place-picker-group">{group.label}</p>
              {group.places.map((place) => {
                const index = flatPlaces.indexOf(place)
                return (
                  <div
                    key={place.id}
                    id={`${listId}-opt-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={place.id === value}
                    className={`place-picker-option${index === activeIndex ? ' place-picker-active' : ''}${place.id === value ? ' place-picker-selected' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(place)}
                  >
                    {place.name}
                  </div>
                )
              })}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
