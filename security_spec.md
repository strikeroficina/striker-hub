# Security Specification - Striker Hub

## Data Invariants
1. A client record must belong to a specific user (the professional).
2. An audit record must reference a valid client (if applicable) and must belong to the user.
3. Users cannot read or write others' data.
4. Timestamps must be server-validated.

## The "Dirty Dozen" Payloads (Deny cases)
1. **Identity Theft**: User A tries to create a client for User B (`/users/B/clients/new`).
2. **Shadow Field**: Adding `isAdmin: true` to a user profile or client.
3. **Invalid ID**: Using a 2MB string as `clientId`.
4. **Time Spoof**: Providing a future or past `createdAt` from the client.
5. **Orphaned Audit**: Creating an audit that doesn't reference a valid user path.
6. **State Shortcut**: Updating an audit from `finalized` back to `draft` without permission or check.
7. **Cross-Tenant Access**: Authenticated User A tries to `get` User B's client.
8. **Malicious Payload**: Sending a 1MB string in the `name` field.
9. **Email Spoof**: User with non-verified email trying to write.
10. **Partial Update Gap**: Updating an immutable field like `createdAt`.
11. **Index Poisoning**: Querying without a specific `userId` filter to scrap data.
12. **Type Poisoning**: Sending `rut_dni` as a boolean instead of string.

## Red Team Audit Strategy
- Verify `request.auth.uid` matches the `{userId}` path.
- Enforce `affectedKeys().hasOnly()` on specific updates.
- Use `isValid[Entity]` helpers for all writes.
