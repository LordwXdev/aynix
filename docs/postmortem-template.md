# Postmortem: TITLE

**Date:** YYYY-MM-DD · **Duration:** HH:MM to HH:MM (Haiti time) · **Author:** NAME · **Severity:** page / ticket

> No blame. We look for what in our system let this happen, not who made a mistake.

## What happened
Two or three sentences a non-technical person can understand.

## Impact
- Who was affected (customers, stores, drivers) and how many
- Orders lost or delayed, money involved
- Error budget used

## Timeline
| Time | What happened |
|---|---|
| 14:02 | Alert `HighErrorRate` fired |
| 14:05 | On call started looking |
| 14:20 | Cause found |
| 14:25 | Rolled back, errors stopped |

## Why it happened
Ask "why?" until you reach something we can change in the system.

## What went well
## What was hard

## Actions
| Action | Owner | Due |
|---|---|---|
| Add an alert for … | | |
| Add a test for … | | |
