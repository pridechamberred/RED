import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { getActivityFeed, getCurrentMember } from "@/lib/data"
import { ACTIVITY_LABELS, isAdmin, type ActivityRow, type ActivityType } from "@/lib/types"
import { coerceActivityFilters, filterActivityRows, type ActivityFilters } from "@/lib/report-filters"

// ExcelJS needs Node APIs (streams/zlib), so this route must not run on Edge.
export const runtime = "nodejs"

/** RED brand red, matching --primary, as an opaque ARGB for the header fill. */
const HEADER_FILL = "FFCF2C2C"

type Column = {
  key: string
  header: string
  width: number
  /** Optional Excel number format applied to the whole data column. */
  numFmt?: string
  value: (row: ActivityRow) => string | number | Date | null
}

/**
 * The exported columns mirror the fields the Admin activity report is built
 * from. A field that doesn't apply to a given activity type is left blank
 * rather than zero-filled, so "no value" reads differently from "0".
 */
const COLUMNS: Column[] = [
  { key: "date", header: "Date", width: 12, numFmt: "yyyy-mm-dd", value: (r) => new Date(`${r.date}T12:00:00Z`) },
  { key: "type", header: "Activity Type", width: 16, value: (r) => ACTIVITY_LABELS[r.type] },
  { key: "member", header: "Member", width: 22, value: (r) => r.memberName },
  { key: "subGroup", header: "Sub-group", width: 14, value: (r) => r.memberSubGroup },
  { key: "with", header: "With", width: 22, value: (r) => r.otherMemberName ?? "" },
  { key: "subject", header: "Subject", width: 26, value: (r) => r.subject ?? "" },
  { key: "source", header: "Referral Source", width: 22, value: (r) => r.referralSourceLabel ?? "" },
  { key: "value", header: "Value (USD)", width: 14, numFmt: "#,##0.00", value: (r) => r.value },
  { key: "recurring", header: "Recurring", width: 11, value: (r) => (r.recurring ? "Yes" : "No") },
  {
    key: "recurringValue",
    header: "Recurring Value (USD)",
    width: 20,
    numFmt: "#,##0.00",
    value: (r) => r.recurringValue,
  },
  { key: "recurringFrequency", header: "Recurring Frequency", width: 18, value: (r) => r.recurringFrequency ?? "" },
  { key: "hours", header: "Volunteer Hours", width: 15, numFmt: "#,##0.##", value: (r) => r.hours },
  { key: "notes", header: "Notes", width: 44, value: (r) => r.notes ?? "" },
]

/** A filename that names the report without leaking specific filter values. */
function buildFilename(filters: ActivityFilters): string {
  const dateStr = new Date().toISOString().slice(0, 10)
  if (filters.type !== "all" && filters.type in ACTIVITY_LABELS) {
    const label = ACTIVITY_LABELS[filters.type as ActivityType].replace(/[^A-Za-z0-9]+/g, "_")
    return `RED_${label}_Report_${dateStr}.xlsx`
  }
  return `RED_Report_${dateStr}.xlsx`
}

export async function POST(request: Request) {
  // Same authorization the Admin page enforces: a session that resolves to an
  // admin or super-admin. Everyone else is rejected before any data is read.
  const me = await getCurrentMember()
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!isAdmin(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const filters = coerceActivityFilters(await request.json().catch(() => ({})))

  // Re-run the authoritative, RLS-scoped query and apply the SAME filter the
  // on-screen feed uses, rather than trusting rows posted by the client. Admins
  // only ever see their own sub-group here; super-admins see everything, and
  // the sub-group filter simply narrows that.
  const rows = await getActivityFeed()
  const filtered = filterActivityRows(rows, filters)

  // Never hand back an empty spreadsheet — the client guards this too, but a
  // direct call must get the same clear signal.
  if (filtered.length === 0) return NextResponse.json({ error: "no-records" }, { status: 422 })

  try {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "incREDible"
    workbook.created = new Date()

    // Freeze the header row so it stays visible while scrolling.
    const sheet = workbook.addWorksheet("RED Report", { views: [{ state: "frozen", ySplit: 1 }] })
    sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }))

    for (const c of COLUMNS) {
      if (c.numFmt) sheet.getColumn(c.key).numFmt = c.numFmt
    }

    for (const row of filtered) {
      const record: Record<string, string | number | Date | null> = {}
      for (const c of COLUMNS) record[c.key] = c.value(row)
      sheet.addRow(record)
    }

    // Distinct, filterable header row.
    const header = sheet.getRow(1)
    header.font = { bold: true, color: { argb: "FFFFFFFF" } }
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } }
    header.alignment = { vertical: "middle", horizontal: "left" }
    header.height = 20
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } }

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${buildFilename(filters)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[v0] XLSX export generation failed:", error)
    return NextResponse.json({ error: "generation-failed" }, { status: 500 })
  }
}
