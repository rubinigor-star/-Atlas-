# Atlas Office event-scoped check-in

## Invariants

- A scan session always belongs to one selected event.
- The mobile client sends both `eventId` and the scanned ticket code.
- The server validates staff permission and event access before touching the ticket.
- A ticket whose order belongs to another event returns `WRONG_EVENT` and is never marked `USED`.
- Check-in is accepted only during the event check-in window.
- Until dedicated check-in fields are added to the persisted event model, the operational default window is 3 hours before `startsAt` through 12 hours after `startsAt`.
- Attendance is calculated from paid tickets whose status is `USED` and displayed as checked-in / sold.
- Atlas Office exposes only operationally active published events in the main event list.

## Follow-up before production merge

1. Verify Expo mobile type-check/build.
2. Verify Next.js Preview build.
3. Device-test a valid ticket, duplicate ticket, cancelled ticket, wrong-event ticket and scan outside the time window.
4. Add persisted `checkInOpensAt` / `checkInClosesAt` only through the repository's verified production database migration path. Do not add ad-hoc schema columns before that migration path is confirmed.
