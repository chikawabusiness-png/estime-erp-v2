import * as XLSX from 'xlsx'
import { FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from './Button'

/**
 * columns: [{ key, label }]
 * data: array of row objects
 */
export default function ExportButton({ data = [], columns = [], filename = 'export' }) {
  const handleExport = () => {
    try {
      if (!data.length) {
        toast.error('Aucune donnée à exporter')
        return
      }
      const rows = data.map((row) =>
        columns.reduce((acc, col) => {
          acc[col.label] = col.render ? col.render(row) : row[col.key]
          return acc
        }, {})
      )
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Données')
      XLSX.writeFile(workbook, `${filename}.xlsx`)
      toast.success('Export Excel réussi')
    } catch (err) {
      toast.error(`Échec de l'export : ${err.message}`)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} ariaLabel="Exporter en Excel">
      <FileSpreadsheet className="w-4 h-4" />
      Exporter
    </Button>
  )
}
