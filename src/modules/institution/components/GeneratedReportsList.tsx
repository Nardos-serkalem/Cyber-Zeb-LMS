import { FileText, FileSpreadsheet, FileType, Download } from 'lucide-react'
import { GlassCard } from '../../../shared/layout/GlassCard'
import { StatusPill, type StatusTone } from '../../../shared/components/StatusPill'
import type { GeneratedReport } from '../types'

interface GeneratedReportsListProps {
  reports: GeneratedReport[]
  onDownload?: (report: GeneratedReport) => void
}

const statusMap: Record<GeneratedReport['status'], { label: string; tone: StatusTone }> = {
  ready: { label: 'Ready', tone: 'success' },
  processing: { label: 'Processing', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'neutral' },
}

const formatIcon: Record<GeneratedReport['format'], typeof FileText> = {
  PDF: FileText,
  Excel: FileSpreadsheet,
  CSV: FileType,
}

export function GeneratedReportsList({ reports, onDownload }: GeneratedReportsListProps) {
  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-extrabold text-[17px] text-navy-900 leading-none">Recent Reports</h3>
        <button className="text-lemon-700 hover:text-lemon-900 font-bold text-[12.5px] cursor-pointer bg-transparent border-none p-0">
          View all
        </button>
      </div>

      <div className="flex flex-col">
        {reports.length === 0 ? (
          <p className="text-[13px] text-secondary-text py-6 text-center">
            No reports yet. Create one to download a PDF of your institution data.
          </p>
        ) : null}
        {reports.map((report) => {
          const status = statusMap[report.status]
          const FormatIcon = formatIcon[report.format]
          return (
            <div
              key={report.id}
              className="flex items-center gap-4 py-3.5 border-b border-divider/40 last:border-0"
            >
              <div className="w-9 h-9 rounded-lg bg-navy-50 text-navy-700 flex items-center justify-center shrink-0">
                <FormatIcon size={16} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-navy-900 text-[13.5px] truncate leading-tight">
                  {report.name}
                </div>
                <div className="text-[11.5px] text-secondary-text mt-0.5">
                  {report.category} · {report.generatedOn}
                </div>
              </div>

              <StatusPill label={status.label} tone={status.tone} />

              <button
                onClick={() => onDownload?.(report)}
                disabled={report.status !== 'ready'}
                className="flex items-center gap-1.5 text-lemon-700 hover:text-lemon-900 font-bold text-[12px] cursor-pointer bg-transparent border-none p-0 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Download size={13} />
                Download
              </button>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}
