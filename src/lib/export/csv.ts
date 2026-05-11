export type CsvColumn<T> = {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

function escapeCsvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

export function formatCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  options?: { includeBom?: boolean }
) {
  const headerRow = columns.map((column) => escapeCsvCell(column.header)).join(",")
  const bodyRows = rows.map((row) =>
    columns
      .map((column) => {
        const value = column.value(row)

        if (value == null) {
          return ""
        }

        return escapeCsvCell(String(value))
      })
      .join(",")
  )

  const csv = [headerRow, ...bodyRows].join("\r\n")

  return options?.includeBom ? `\uFEFF${csv}` : csv
}
