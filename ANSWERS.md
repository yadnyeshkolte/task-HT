# Frontend Assessment Answers

## 1. How to run

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL Vite prints in the terminal, usually `http://localhost:5173`.

For a production build check:

```bash
npm run build
```

No deployed URL is included.

## 2. Stack & design choices

I used React with TypeScript and Vite because the app has a small but stateful UI: adding habits, inline renaming, deleting, toggling dates, navigating weeks, and persisting everything across reloads. React keeps the state transitions explicit, TypeScript helps keep the `habits` and `completions` data shape safe, and Vite keeps the project easy to run locally.

I made the tracker a semantic weekly table instead of a list of habit cards. Habits run down the left and dates run across the top, which matches the way people scan weekly progress. The habit name column stays sticky while the grid scrolls horizontally on narrow screens, so a 360px phone can still show the real weekly grid instead of hiding days behind a separate mobile layout.

I highlighted today's full column in warm yellow and kept completed checkmarks green. The yellow answers "where am I today?" while green is reserved for "what is done?", so color has two clear jobs. Future dates are visible but disabled because seeing the rest of the week helps orientation without inviting invalid entries.

The week starts on Monday because this app is framed around weekly routine tracking, and Monday-to-Sunday matches the common work/school planning rhythm. The streak counter counts through today if today is checked; if today is not checked yet, it counts through yesterday. That prevents a streak from dropping to zero early in the day before the user has had a fair chance to complete the habit.

## 3. Responsive & accessibility

On a 360px-wide phone, the header and add form stack vertically, the summary stays compact, and the weekly table scrolls horizontally with the habit names pinned on the left. On a 1440px laptop, the same data expands into a wider table with all seven days visible at once and more breathing room around the controls.

One accessibility detail I handled is the grid's button semantics: each day cell is a real button with `aria-pressed`, a specific screen-reader label, visible focus states, and disabled future dates. The table also uses column and row headers so dates and habit names are not just visual labels.

One thing I knowingly skipped is live announcements when a checkmark changes. The pressed state is available to assistive tech, but a polite live region could make rapid toggling clearer for screen-reader users. I skipped it to avoid noisy announcements in a dense grid for this small submission.

## 4. AI usage

I used OpenAI Codex in this repository to build the React/TypeScript implementation, replace the starter Vite screen, write the responsive CSS, and draft this README and answers file. I asked it to implement the full habit tracker assessment from the existing Vite app and to verify the result with a production build.

One concrete change from the AI-generated output was after running `npm run build`: the generated code initially imported `FormEvent` as a normal React import. TypeScript rejected that because this project has `verbatimModuleSyntax` enabled, so I changed it to `import type { FormEvent } from 'react'`. I also kept the layout as a semantic table with horizontal overflow rather than converting the phone layout into separate cards, because the assessment specifically asks reviewers to inspect the weekly grid behavior.

No AI image generation or external design-generation tool was used.

## 5. Honest gap

The least polished part is deletion: it removes a habit immediately. With another day, I would add an undo toast and keep the deleted habit in temporary state for a few seconds, because accidental deletion is likely in a tracker people use repeatedly.
