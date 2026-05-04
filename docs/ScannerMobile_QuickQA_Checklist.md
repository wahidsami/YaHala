# Scanner Mobile Quick QA Script

Use this script during live pilot verification. Check each item when done.

## Session Setup
- [ ] API reachable at configured mobile base URL.
- [ ] Scanner credentials available.
- [ ] Test event and test token available.

## Core Flow
- [ ] Login succeeds.
- [ ] Assigned events appear.
- [ ] Camera scan valid QR works.
- [ ] Duplicate scan recognized.
- [ ] Manual scan fallback works.
- [ ] Invalid token shows graceful error.

## Walk-in Voice Flow
- [ ] Record voice and transcribe.
- [ ] Extracted fields appear.
- [ ] Confidence chips and warnings visible.
- [ ] Manual correction possible.
- [ ] Approve & Add works.
- [ ] Approve & Check In works.
- [ ] Invitation status returns (`queued` or `skipped`).

## Stats + Language
- [ ] Stats cards load.
- [ ] Stats update after scan/walk-in.
- [ ] Arabic mode with Cairo font verified.
- [ ] English mode verified.

## Completion
- [ ] No blocker defects.
- [ ] Defects logged with reproduction details.
- [ ] Pilot signoff recommendation recorded.
