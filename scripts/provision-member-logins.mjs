/**
 * Provisions a login for every member row that does not have one yet.
 *
 * Each new account is created already email-confirmed (so nobody waits on a
 * confirmation email) on the shared temporary password, and flagged with
 * must_change_password so the app forces them to choose their own on first sign
 * in. The on_auth_user_created trigger links the new auth user to the matching
 * member row by email, so roles and sub-groups carry over automatically.
 *
 * Safe to re-run: accounts that already exist are skipped, never reset. That
 * matters because re-running must not knock a member back onto the shared
 * password after they have chosen a private one.
 *
 * Usage:
 *   node --env-file=.env.development.local scripts/provision-member-logins.mjs
 *   node --env-file=.env.development.local scripts/provision-member-logins.mjs --delete-orphans
 */

// Must stay in sync with lib/temporary-password.ts. Not imported from there:
// that module is marked "server-only" and is TypeScript, neither of which a
// plain Node script can load.
const TEMPORARY_PASSWORD = "R3dR0ck5!"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

const authHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
}

const deleteOrphans = process.argv.includes("--delete-orphans")

async function listAuthUsers() {
  const users = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: authHeaders })
    if (!res.ok) throw new Error(`admin/users failed: ${res.status} ${await res.text()}`)
    const body = await res.json()
    const batch = body.users ?? []
    users.push(...batch)
    if (batch.length < 200) break
  }
  return users
}

async function listMembers() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=email,first_name,last_name,role,sub_group`, {
    headers: authHeaders,
  })
  if (!res.ok) throw new Error(`members failed: ${res.status} ${await res.text()}`)
  return res.json()
}

const members = await listMembers()
const authUsers = await listAuthUsers()

const memberEmails = new Set(members.map((m) => m.email.trim().toLowerCase()))
const authEmails = new Set(authUsers.map((u) => (u.email ?? "").trim().toLowerCase()))

console.log(`members: ${members.length} | existing logins: ${authUsers.length}`)

// --- 1. Orphaned auth accounts: a login with no matching member row ----------
const orphans = authUsers.filter((u) => !memberEmails.has((u.email ?? "").trim().toLowerCase()))

if (orphans.length === 0) {
  console.log("\nno orphaned logins")
} else {
  console.log(`\norphaned logins (no member row): ${orphans.length}`)
  for (const orphan of orphans) {
    if (!deleteOrphans) {
      console.log(`  would delete ${orphan.email} (re-run with --delete-orphans)`)
      continue
    }
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${orphan.id}`, {
      method: "DELETE",
      headers: authHeaders,
    })
    console.log(`  ${res.ok ? "deleted" : `FAILED (${res.status})`} ${orphan.email}`)
  }
}

// --- 2. Create a login for every member that lacks one -----------------------
const needsLogin = members.filter((m) => !authEmails.has(m.email.trim().toLowerCase()))

console.log(`\nmembers needing a login: ${needsLogin.length}`)

let created = 0
const failures = []

for (const member of needsLogin) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email: member.email.trim().toLowerCase(),
      password: TEMPORARY_PASSWORD,
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
        first_name: member.first_name,
        last_name: member.last_name,
      },
    }),
  })

  if (res.ok) {
    created++
  } else {
    failures.push(`${member.email} -> ${res.status} ${(await res.text()).slice(0, 120)}`)
  }
}

console.log(`created: ${created}`)
if (failures.length) {
  console.log(`\nfailures (${failures.length}):`)
  failures.forEach((f) => console.log("  " + f))
}

// --- 3. Verify -------------------------------------------------------------
const after = await listAuthUsers()
const unlinked = members.filter((m) => !after.some((u) => (u.email ?? "").toLowerCase() === m.email.toLowerCase()))
const pending = after.filter((u) => u.user_metadata?.must_change_password === true).length

console.log(`\nlogins now: ${after.length} | members without a login: ${unlinked.length}`)
console.log(`awaiting first-time password change: ${pending}`)
