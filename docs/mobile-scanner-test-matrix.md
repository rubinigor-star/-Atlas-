# Atlas Office scanner test matrix

| Case | Expected result |
| --- | --- |
| Valid paid ticket for selected event inside check-in window | `VALID`, ticket becomes `USED`, attendance +1 |
| Same ticket scanned again | `USED`, attendance unchanged |
| Cancelled ticket for selected event | `CANCELLED`, attendance unchanged |
| Unknown QR | `NOT_FOUND`, attendance unchanged |
| Valid ticket for another event | `WRONG_EVENT`, ticket remains unchanged |
| Selected event before check-in window | `CHECKIN_CLOSED`, ticket remains unchanged |
| Selected event after check-in window | `CHECKIN_CLOSED`, ticket remains unchanged |
| Staff without `SCAN` permission | `FORBIDDEN`, ticket remains unchanged |
| Staff outside selected event scope | `EVENT_ACCESS_DENIED`, ticket remains unchanged |
| No `eventId` in mobile scanner route | Camera scan is not started and user is told to choose an event |
| Active event card | Progress is checked-in / sold, not sold / capacity |
| Missing or blank poster URL | Mobile UI displays fallback artwork instead of trying to load an invalid URL |
