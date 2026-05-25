import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Habit = {
  id: string
  name: string
  createdAt: string
}

type CompletionMap = Record<string, Record<string, boolean>>

type TrackerState = {
  habits: Habit[]
  completions: CompletionMap
}

const STORAGE_KEY = 'habit-tracker-weekly-state-v1'
const emptyState: TrackerState = { habits: [], completions: {} }

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const monthDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfDay(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function startOfWeek(date: Date) {
  const nextDate = startOfDay(date)
  const mondayOffset = (nextDate.getDay() + 6) % 7
  return addDays(nextDate, -mondayOffset)
}

function createHabitId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadState(): TrackerState {
  try {
    const storedState = localStorage.getItem(STORAGE_KEY)

    if (!storedState) {
      return emptyState
    }

    const parsedState = JSON.parse(storedState) as Partial<TrackerState>

    if (!Array.isArray(parsedState.habits)) {
      return emptyState
    }

    const habits = parsedState.habits.filter((habit): habit is Habit => {
      return (
        typeof habit?.id === 'string' &&
        typeof habit.name === 'string' &&
        typeof habit.createdAt === 'string'
      )
    })

    const completions =
      parsedState.completions && typeof parsedState.completions === 'object'
        ? parsedState.completions
        : {}

    return { habits, completions }
  } catch {
    return emptyState
  }
}

function getWeekLabel(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  const startYear = weekStart.getFullYear()
  const endYear = weekEnd.getFullYear()
  const yearLabel = startYear === endYear ? startYear : `${startYear}/${endYear}`

  return `${monthDayFormatter.format(weekStart)} - ${monthDayFormatter.format(weekEnd)}, ${yearLabel}`
}

function calculateCurrentStreak(completions: Record<string, boolean> | undefined, todayKey: string) {
  if (!completions) {
    return 0
  }

  let cursor = fromDateKey(todayKey)

  if (!completions[toDateKey(cursor)]) {
    cursor = addDays(cursor, -1)
  }

  let streak = 0

  while (completions[toDateKey(cursor)]) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function App() {
  const [trackerState, setTrackerState] = useState<TrackerState>(loadState)
  const [newHabitName, setNewHabitName] = useState('')
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfWeek(new Date()))
  const [lastCheckedCell, setLastCheckedCell] = useState<string | null>(null)

  const today = startOfDay(new Date())
  const todayKey = toDateKey(today)
  const currentWeekStartKey = toDateKey(startOfWeek(today))

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, dayIndex) => addDays(selectedWeekStart, dayIndex))
  }, [selectedWeekStart])

  const streaksByHabit = useMemo(() => {
    return trackerState.habits.reduce<Record<string, number>>((streaks, habit) => {
      streaks[habit.id] = calculateCurrentStreak(trackerState.completions[habit.id], todayKey)
      return streaks
    }, {})
  }, [trackerState.completions, trackerState.habits, todayKey])

  const todayCompleted = trackerState.habits.filter((habit) => {
    return trackerState.completions[habit.id]?.[todayKey]
  }).length

  const bestCurrentStreak = Math.max(0, ...Object.values(streaksByHabit))

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trackerState))
    } catch {
      // Persistence can fail in restricted browsing modes; the app should still work in-memory.
    }
  }, [trackerState])

  function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = newHabitName.trim()

    if (!trimmedName) {
      return
    }

    const habit: Habit = {
      id: createHabitId(),
      name: trimmedName,
      createdAt: todayKey,
    }

    setTrackerState((currentState) => ({
      habits: [...currentState.habits, habit],
      completions: { ...currentState.completions, [habit.id]: {} },
    }))
    setNewHabitName('')
  }

  function renameHabit(habitId: string, nextName: string) {
    setTrackerState((currentState) => ({
      ...currentState,
      habits: currentState.habits.map((habit) =>
        habit.id === habitId ? { ...habit, name: nextName.slice(0, 48) } : habit,
      ),
    }))
  }

  function finalizeHabitName(habitId: string) {
    setTrackerState((currentState) => ({
      ...currentState,
      habits: currentState.habits.map((habit) => {
        if (habit.id !== habitId) {
          return habit
        }

        const trimmedName = habit.name.trim()

        return { ...habit, name: trimmedName || 'Untitled habit' }
      }),
    }))
  }

  function deleteHabit(habitId: string) {
    setTrackerState((currentState) => {
      const { [habitId]: _removedHabit, ...remainingCompletions } = currentState.completions

      return {
        habits: currentState.habits.filter((habit) => habit.id !== habitId),
        completions: remainingCompletions,
      }
    })
  }

  function toggleCompletion(habitId: string, dateKey: string) {
    if (dateKey > todayKey) {
      return
    }

    const cellKey = `${habitId}-${dateKey}`
    const isCurrentlyComplete = Boolean(trackerState.completions[habitId]?.[dateKey])

    if (!isCurrentlyComplete) {
      setLastCheckedCell(cellKey)
    }

    setTrackerState((currentState) => {
      const currentHabitCompletions = currentState.completions[habitId] ?? {}
      const nextHabitCompletions = { ...currentHabitCompletions }

      if (nextHabitCompletions[dateKey]) {
        delete nextHabitCompletions[dateKey]
      } else {
        nextHabitCompletions[dateKey] = true
      }

      return {
        ...currentState,
        completions: {
          ...currentState.completions,
          [habitId]: nextHabitCompletions,
        },
      }
    })
  }

  function getDayTotal(dateKey: string) {
    return trackerState.habits.reduce((total, habit) => {
      return total + (trackerState.completions[habit.id]?.[dateKey] ? 1 : 0)
    }, 0)
  }

  return (
    <main className="app">
      <div className="app-shell">
        <header className="app-header">
          <div>
            <p className="eyebrow">Weekly habits</p>
            <h1>Habit Tracker</h1>
            <p className="date-line">{fullDateFormatter.format(today)}</p>
          </div>
          <div className="today-score" aria-label={`${todayCompleted} of ${trackerState.habits.length} habits complete today`}>
            <span>{todayCompleted}</span>
            <small>/ {trackerState.habits.length || 0} today</small>
          </div>
        </header>

        <section className="add-panel" aria-labelledby="add-habit-heading">
          <div>
            <h2 id="add-habit-heading">Add habit</h2>
            <p>Short names work best in the weekly grid.</p>
          </div>
          <form className="add-form" onSubmit={addHabit}>
            <label className="visually-hidden" htmlFor="new-habit">
              Habit name
            </label>
            <input
              id="new-habit"
              value={newHabitName}
              onChange={(event) => setNewHabitName(event.target.value)}
              maxLength={48}
              placeholder="Read 30 min"
            />
            <button className="primary-button" type="submit">
              Add habit
            </button>
          </form>
        </section>

        <section className="summary-grid" aria-label="Current progress summary">
          <div className="summary-item">
            <span>{trackerState.habits.length}</span>
            <small>{trackerState.habits.length === 1 ? 'habit' : 'habits'}</small>
          </div>
          <div className="summary-item">
            <span>{todayCompleted}/{trackerState.habits.length || 0}</span>
            <small>today</small>
          </div>
          <div className="summary-item">
            <span>{bestCurrentStreak}</span>
            <small>best streak</small>
          </div>
        </section>

        <section className="tracker-panel" aria-labelledby="week-heading">
          <div className="tracker-toolbar">
            <div>
              <p className="eyebrow">Week of</p>
              <h2 id="week-heading">{getWeekLabel(selectedWeekStart)}</h2>
            </div>
            <div className="week-controls">
              <button
                className="icon-button"
                type="button"
                onClick={() => setSelectedWeekStart((currentStart) => addDays(currentStart, -7))}
                aria-label="Previous week"
                title="Previous week"
              >
                &lt;
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setSelectedWeekStart(startOfWeek(new Date()))}
                disabled={toDateKey(selectedWeekStart) === currentWeekStartKey}
              >
                This week
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSelectedWeekStart((currentStart) => addDays(currentStart, 7))}
                aria-label="Next week"
                title="Next week"
              >
                &gt;
              </button>
            </div>
          </div>

          {trackerState.habits.length === 0 ? (
            <div className="empty-state">
              <h2>No habits yet</h2>
              <p>Add your first habit above and this week will fill in here.</p>
            </div>
          ) : (
            <div className="grid-scroll" role="region" aria-label="Weekly habit grid" tabIndex={0}>
              <table className="habit-table">
                <colgroup>
                  <col className="habit-name-column" />
                  <col className="streak-column" />
                  {weekDays.map((day) => (
                    <col className="day-column" key={toDateKey(day)} />
                  ))}
                  <col className="action-column" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="habit-name-header" scope="col">
                      Habit
                    </th>
                    <th scope="col">Streak</th>
                    {weekDays.map((day) => {
                      const dateKey = toDateKey(day)
                      const isToday = dateKey === todayKey

                      return (
                        <th className={isToday ? 'day-header is-today' : 'day-header'} key={dateKey} scope="col">
                          <span>{weekdayFormatter.format(day)}</span>
                          <strong>{day.getDate()}</strong>
                        </th>
                      )
                    })}
                    <th className="actions-header" scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trackerState.habits.map((habit) => {
                    const streak = streaksByHabit[habit.id] ?? 0

                    return (
                      <tr key={habit.id}>
                        <th className="habit-name-cell" scope="row">
                          <input
                            aria-label={`Rename ${habit.name || 'habit'}`}
                            className="habit-name-input"
                            value={habit.name}
                            onBlur={() => finalizeHabitName(habit.id)}
                            onChange={(event) => renameHabit(habit.id, event.target.value)}
                          />
                        </th>
                        <td className="streak-cell">
                          <span className={streak > 0 ? 'streak-pill is-active' : 'streak-pill'}>
                            <strong>{streak}</strong>
                            <small>{streak === 1 ? 'day' : 'days'}</small>
                          </span>
                        </td>
                        {weekDays.map((day) => {
                          const dateKey = toDateKey(day)
                          const isToday = dateKey === todayKey
                          const isFuture = dateKey > todayKey
                          const isComplete = Boolean(trackerState.completions[habit.id]?.[dateKey])
                          const cellKey = `${habit.id}-${dateKey}`

                          return (
                            <td className={isToday ? 'completion-cell is-today' : 'completion-cell'} key={dateKey}>
                              <button
                                aria-label={`${habit.name || 'Habit'} is ${
                                  isComplete ? 'complete' : 'not complete'
                                } on ${fullDateFormatter.format(day)}`}
                                aria-pressed={isComplete}
                                className={
                                  lastCheckedCell === cellKey && isComplete
                                    ? 'completion-toggle just-checked'
                                    : 'completion-toggle'
                                }
                                disabled={isFuture}
                                onAnimationEnd={() => {
                                  if (lastCheckedCell === cellKey) {
                                    setLastCheckedCell(null)
                                  }
                                }}
                                onClick={() => toggleCompletion(habit.id, dateKey)}
                                title={isFuture ? 'Future days are disabled' : fullDateFormatter.format(day)}
                                type="button"
                              >
                                <span className="checkmark" aria-hidden="true" />
                              </button>
                            </td>
                          )
                        })}
                        <td className="action-cell">
                          <button
                            aria-label={`Delete ${habit.name || 'habit'}`}
                            className="delete-button"
                            onClick={() => deleteHabit(habit.id)}
                            title="Delete habit"
                            type="button"
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th className="habit-name-cell" scope="row">
                      Daily total
                    </th>
                    <td />
                    {weekDays.map((day) => {
                      const dateKey = toDateKey(day)
                      const isToday = dateKey === todayKey

                      return (
                        <td className={isToday ? 'total-cell is-today' : 'total-cell'} key={dateKey}>
                          {getDayTotal(dateKey)}/{trackerState.habits.length}
                        </td>
                      )
                    })}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
