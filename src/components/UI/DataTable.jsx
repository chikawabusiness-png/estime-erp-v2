export default function DataTable({ columns, data, emptyLabel = 'Aucune donnée', rowKey = 'id' }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-10 text-base-content/60" role="status">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="table-responsive">
      <table className="table table-zebra">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
