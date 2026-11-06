# Security changes and rollout

This is a local patch, not a production deployment. Deploy the updated client and matching Realtime Database rules together after reviewing and approving the rollout. Enable Firebase Anonymous Authentication before enabling these rules. Old five-digit rooms and the previous unauthenticated client are intentionally incompatible.

## Access model

- Default deny, including root and global room listing.
- Anonymous Firebase authentication supplies stable UIDs. Each room is owned by its creator's UID. Host ownership and timestamps cannot be reassigned.
- Eight-digit room codes identify rooms. Authenticated clients can read known active-room metadata (and absent metadata for collision checks). Knowing a code allows joining an active room; this is not an invitation-only system.
- Rooms have a maximum 24-hour lifetime. Expiration blocks client reads and writes; it does not delete stored data. Any retention cleanup needs separately authorized administrative tooling.
- Students create and update only their own UID-keyed player record. They can read the roster after joining, and read only their own private inbox, request and results. They cannot change other students or emit feed/inbox events.
- Host-only atomic room transactions resolve steal requests. One pending request per requester is allowed. Students may cancel their own pending request and acknowledge their own events/results by deleting them.
- Unknown fields, invalid types, oversized names, out-of-range gameplay values, malformed join/create timestamps, owner changes and overlong expiration are denied. Student gameplay values are frozen outside playing status. Online/name updates remain allowed.
- Host credentials are the anonymous account in that browser. Clearing site data/signing out can lose control of a room. Do not share host browser access.

## Remaining trust boundaries

This patch stops unauthenticated access and cross-player writes, but is not an anti-cheat server. During play, students still compute their own score, correct/incorrect counts, progress and purchased boosts; these values are bounded but a modified client could falsify its own record. Authoritative scoring would require server-side round and purchase validation. A room code can be guessed, shared or brute-forced; add admission approval/App Check/rate limiting if stronger classroom access is needed. The host must remain connected to process steals. This code does not administer API-key restrictions, App Check, quotas or cloud project settings.

## Tests

Prerequisites: Node.js 20+ and Java 21+. Install with `npm ci`, then run `npm test`. The CLI uses only the demo project `demo-ratio-card-battle`; do not substitute a production project in tests. Expected permission-denied warnings are assertions, not failures.

In a restricted workspace with a non-writable home cache, use `FIREBASE_EMULATORS_PATH=/tmp/rcb-emulators` and `npm --cache /tmp/rcb-npm-cache`. The Firebase Node SDK ignores NO_PROXY for its WebSocket transport. Where HTTP_PROXY is set, the following command runs only the emulator-bound test child without that variable:

```
FIREBASE_EMULATORS_PATH=/tmp/rcb-emulators XDG_CONFIG_HOME=/tmp/rcb-config \
  ./node_modules/.bin/firebase emulators:exec --only database \
  --project demo-ratio-card-battle \
  'env -u HTTP_PROXY -u http_proxy node --test --test-concurrency=1 tests/game.test.cjs tests/database.rules.test.mjs tests/ui.test.mjs'
```

The test file hardcodes 127.0.0.1:9000 and a demo project. It never accesses the production Firebase project.

Verified locally: 12 tests passed, zero failed, skipped or cancelled. Coverage: unauthenticated access and global listing denial; metadata versus room/roster access; creation ownership/code/lifetime checks; immutable ownership/timestamps and unknown-field rejection; valid and invalid joins; own gameplay and cross-player write denial; one pending request and cancellation; private queues and host-only events/results; whole-room host transaction and end/kick/delete lifecycle; expiry; prejoin self reads and non-playing freeze; concurrent requests and hitAt deletion protection. This is database-rules testing, not end-to-end browser UI validation.


Additional local verification: 17 game-logic assertions and two JSDOM UI simulations pass. The UI simulation runs the shipped application script with mocked authentication identities and actual database-emulator permission enforcement. It covers teacher room creation, two students joining, playing, atomic stealing, reconnecting with preserved score, ending/results, offline markers, solo play and code validation. It does not test live Firebase Authentication or real-browser rendering. Cloud browser could not reach this workspace localhost, so visual/multidevice production QA remains required.

Rollout changes user experience: new codes are eight digits, old five-digit rooms are locked out, host screen must stay open for steals, and rooms expire after 24 hours. Existing data is not automatically deleted. Names can be replaced with classroom nicknames. CSV exports neutralize formula-leading text.
