# Security Specification — Operative Cloud Storage Database

## 1. Data Invariants
1. Every document in `/operatives/{uid}` MUST belong exclusively to the authenticated, email-verified user whose `request.auth.uid == uid`.
2. Every document ID `{uid}` MUST satisfy `isValidId(uid)` (`<= 128` chars matching `^[a-zA-Z0-9_\\-]+$`).
3. No unauthenticated or unverified user may read, list, create, update, or delete any `/operatives/{uid}` document.
4. `list` queries on `/operatives` are unconditionally denied (`allow list: if false;`) to prevent cross-account scraping.
5. `uid` and `createdAt` are immutable after creation (`request.time` enforced on create/update).
6. All strings (`username`, `bio`, `avatarId`, `loadout.*`), numeric counters (`wallet.*`, `stats.*`), and arrays (`ownedItems`, `loadout.gadgetIds`) are strictly bounded and validated via `isValidOperativeProfile()`.

## 2. Dirty Dozen Attack Payloads (All Must Return `PERMISSION_DENIED`)
1. Unauthenticated read/write to `/operatives/user123`.
2. Authenticated user with `email_verified: false` creating `/operatives/user123`.
3. Authenticated user `alice` reading `/operatives/bob`.
4. Authenticated user listing `/operatives` collection (`getDocs(collection(db, 'operatives'))`).
5. Creating `/operatives/alice` with `uid: "bob"` (identity spoofing).
6. Creating `/operatives/alice` with extra shadow field `{ isAdmin: true }`.
7. Creating `/operatives/alice` with client-forged `createdAt` timestamp instead of `request.time`.
8. Updating `/operatives/alice` attempting to mutate `uid` or `createdAt`.
9. Updating `/operatives/alice` with `bio` longer than 140 characters.
10. Updating `/operatives/alice` with negative `wallet.coins: -500`.
11. Updating `/operatives/alice` with `ownedItems` containing > 40 items or empty array.
12. Creating document with oversized/malformed path ID `/operatives/bad$id!`.
