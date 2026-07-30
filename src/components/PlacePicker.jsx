import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { marinas, placeRegions } from '../data'

// The list spans working harbors, open anchorages, and lighthouses you'd only
// stand off and look at, across six bodies of water. Grouping by region and then
// by kind keeps ninety entries scannable, puts everything near a destination
// together, and still warns the helm that picking "Greens Ledge Light" is not
// picking a place to tie up.
const KIND_GROUPS = [
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
const MIN_LIST_PX = 132
const MAX_LIST_PX = 260

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
  const [placement, setPlacement] = useState({ above: false, maxHeight: MAX_LIST_PX })
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

  // Regions run west to east and places keep their data.js order within one — a
  // geographic ordering worth preserving in the results.
  const groups = useMemo(() => (
    placeRegions
      .flatMap((region) => KIND_GROUPS.map(({ label: kindLabel, match }) => ({
        label: `${region} — ${kindLabel}`,
        places: marinas.filter((m) => m.region === region && match(m) && matchesQuery(m, terms)),
      })))
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

  // In the mobile bottom sheet the field can sit low enough that a downward
  // list runs under the tab bar, so flip it above the input when there is more
  // room up there. Measured before paint to avoid a visible jump.
  useLayoutEffect(() => {
    if (!open || !fieldRef.current) return
    const rect = fieldRef.current.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - BOTTOM_CHROME_PX
    const above = rect.top - 8
    const useAbove = below < MIN_LIST_PX && above > below
    const room = useAbove ? above : below
    setPlacement({ above: useAbove, maxHeight: Math.max(MIN_LIST_PX, Math.min(MAX_LIST_PX, room)) })
  }, [open, groups])

  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return
    const option = listRef.current.querySelector(`[data-index="${activeIndex}"]`)
    if (option) option.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) close()
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

      {open && (
        <div
          className={`place-picker-list${placement.above ? ' place-picker-list-above' : ''}`}
          style={{ maxHeight: `${placement.maxHeight}px` }}
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
        </div>
      )}
    </div>
  )
}
