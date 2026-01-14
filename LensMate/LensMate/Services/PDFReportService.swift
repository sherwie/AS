import Foundation
import PDFKit
import UIKit

/// Report data structure for PDF generation
struct WearReport {
    let startDate: Date
    let endDate: Date
    let sessions: [WearSession]
    let healthEntries: [HealthEntry]
    let lensProfile: LensProfile?
    let doctorProfile: DoctorProfile?

    var totalWearDays: Int {
        let uniqueDates = Set(sessions.map { Calendar.current.startOfDay(for: $0.date) })
        return uniqueDates.count
    }

    var totalWearHours: Double {
        let totalSeconds = sessions.reduce(0) { $0 + $1.totalDurationSeconds }
        return Double(totalSeconds) / 3600.0
    }

    var averageDailyWearHours: Double {
        guard totalWearDays > 0 else { return 0 }
        return totalWearHours / Double(totalWearDays)
    }

    var maxSingleDayWearHours: Double {
        let dailyTotals = Dictionary(grouping: sessions) { session in
            Calendar.current.startOfDay(for: session.date)
        }.mapValues { sessions in
            sessions.reduce(0) { $0 + $1.totalDurationSeconds }
        }

        guard let maxSeconds = dailyTotals.values.max() else { return 0 }
        return Double(maxSeconds) / 3600.0
    }

    var averageComfortScore: Double {
        let scores = healthEntries.map { $0.comfortScore }
        guard !scores.isEmpty else { return 0 }
        return Double(scores.reduce(0, +)) / Double(scores.count)
    }

    var symptomFrequency: [String: Int] {
        var frequency: [String: Int] = [
            "Dryness": 0,
            "Redness": 0,
            "Irritation": 0,
            "Burning": 0
        ]

        for entry in healthEntries {
            if entry.hasDryness { frequency["Dryness", default: 0] += 1 }
            if entry.hasRedness { frequency["Redness", default: 0] += 1 }
            if entry.hasIrritation { frequency["Irritation", default: 0] += 1 }
            if entry.hasBurning { frequency["Burning", default: 0] += 1 }
        }

        return frequency
    }
}

/// Generates PDF reports for wear history and health data
final class PDFReportService {

    private let pageWidth: CGFloat = 612
    private let pageHeight: CGFloat = 792
    private let margin: CGFloat = 50

    private var contentWidth: CGFloat {
        pageWidth - (margin * 2)
    }

    private let titleFont = UIFont.systemFont(ofSize: 24, weight: .bold)
    private let headingFont = UIFont.systemFont(ofSize: 16, weight: .semibold)
    private let bodyFont = UIFont.systemFont(ofSize: 12, weight: .regular)
    private let captionFont = UIFont.systemFont(ofSize: 10, weight: .regular)

    private let primaryColor = UIColor.systemBlue
    private let textColor = UIColor.black
    private let secondaryTextColor = UIColor.darkGray

    /// Generate a PDF report from wear data
    func generateReport(from report: WearReport) -> Data {
        let pdfMetaData = [
            kCGPDFContextCreator: "LensMate",
            kCGPDFContextAuthor: "LensMate App",
            kCGPDFContextTitle: "Contact Lens Wear Report"
        ]

        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetaData as [String: Any]

        let pageRect = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)

        let data = renderer.pdfData { context in
            context.beginPage()

            var yPosition: CGFloat = margin

            yPosition = drawHeader(at: yPosition, report: report, in: context)
            yPosition = drawSummarySection(at: yPosition, report: report, in: context)
            yPosition = drawComfortSection(at: yPosition, report: report, in: context)
            yPosition = drawSymptomSection(at: yPosition, report: report, in: context)

            if report.lensProfile != nil || report.doctorProfile != nil {
                if yPosition > pageHeight - 200 {
                    context.beginPage()
                    yPosition = margin
                }
                yPosition = drawProfileSection(at: yPosition, report: report, in: context)
            }

            drawFooter(in: context)
        }

        return data
    }

    private func drawHeader(at yPosition: CGFloat, report: WearReport, in context: UIGraphicsPDFRendererContext) -> CGFloat {
        var y = yPosition

        let title = "Contact Lens Wear Report"
        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: titleFont,
            .foregroundColor: primaryColor
        ]
        title.draw(at: CGPoint(x: margin, y: y), withAttributes: titleAttributes)
        y += 35

        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium

        let dateRange = "\(dateFormatter.string(from: report.startDate)) - \(dateFormatter.string(from: report.endDate))"
        let dateAttributes: [NSAttributedString.Key: Any] = [
            .font: bodyFont,
            .foregroundColor: secondaryTextColor
        ]
        dateRange.draw(at: CGPoint(x: margin, y: y), withAttributes: dateAttributes)
        y += 25

        let line = UIBezierPath()
        line.move(to: CGPoint(x: margin, y: y))
        line.addLine(to: CGPoint(x: pageWidth - margin, y: y))
        primaryColor.setStroke()
        line.lineWidth = 2
        line.stroke()

        return y + 20
    }

    private func drawSummarySection(at yPosition: CGFloat, report: WearReport, in context: UIGraphicsPDFRendererContext) -> CGFloat {
        var y = yPosition

        y = drawSectionTitle("Wear Summary", at: y)

        let summaryItems = [
            ("Total Wear Days", "\(report.totalWearDays) days"),
            ("Total Wear Time", String(format: "%.1f hours", report.totalWearHours)),
            ("Average Daily Wear", String(format: "%.1f hours", report.averageDailyWearHours)),
            ("Maximum Single Day", String(format: "%.1f hours", report.maxSingleDayWearHours)),
            ("Total Sessions", "\(report.sessions.count)")
        ]

        for (label, value) in summaryItems {
            y = drawLabelValue(label: label, value: value, at: y)
        }

        return y + 15
    }

    private func drawComfortSection(at yPosition: CGFloat, report: WearReport, in context: UIGraphicsPDFRendererContext) -> CGFloat {
        var y = yPosition

        y = drawSectionTitle("Comfort Analysis", at: y)

        let comfortValue = report.healthEntries.isEmpty
            ? "No data"
            : String(format: "%.1f / 10", report.averageComfortScore)

        y = drawLabelValue(label: "Average Comfort Score", value: comfortValue, at: y)
        y = drawLabelValue(label: "Health Entries Logged", value: "\(report.healthEntries.count)", at: y)

        return y + 15
    }

    private func drawSymptomSection(at yPosition: CGFloat, report: WearReport, in context: UIGraphicsPDFRendererContext) -> CGFloat {
        var y = yPosition

        y = drawSectionTitle("Symptom Frequency", at: y)

        let frequency = report.symptomFrequency
        let total = report.healthEntries.count

        for (symptom, count) in frequency.sorted(by: { $0.key < $1.key }) {
            let percentage = total > 0 ? (Double(count) / Double(total)) * 100 : 0
            let value = total > 0
                ? "\(count) occurrences (\(String(format: "%.0f%%", percentage)))"
                : "No data"
            y = drawLabelValue(label: symptom, value: value, at: y)
        }

        return y + 15
    }

    private func drawProfileSection(at yPosition: CGFloat, report: WearReport, in context: UIGraphicsPDFRendererContext) -> CGFloat {
        var y = yPosition

        if let lens = report.lensProfile {
            y = drawSectionTitle("Lens Information", at: y)
            y = drawLabelValue(label: "Lens Type", value: lens.lensType.displayName, at: y)
            if let brand = lens.brandName, !brand.isEmpty {
                y = drawLabelValue(label: "Brand", value: brand, at: y)
            }
            y = drawLabelValue(label: "Replacement Cycle", value: "\(lens.replacementCycleDays) days", at: y)
            y += 15
        }

        if let doctor = report.doctorProfile, doctor.hasInformation {
            y = drawSectionTitle("Eye Care Provider", at: y)
            if let name = doctor.doctorName, !name.isEmpty {
                y = drawLabelValue(label: "Doctor", value: name, at: y)
            }
            if let clinic = doctor.clinicName, !clinic.isEmpty {
                y = drawLabelValue(label: "Clinic", value: clinic, at: y)
            }
            if let od = doctor.prescriptionOD, !od.isEmpty {
                y = drawLabelValue(label: "Right Eye (OD)", value: od, at: y)
            }
            if let os = doctor.prescriptionOS, !os.isEmpty {
                y = drawLabelValue(label: "Left Eye (OS)", value: os, at: y)
            }
        }

        return y
    }

    private func drawSectionTitle(_ title: String, at yPosition: CGFloat) -> CGFloat {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: headingFont,
            .foregroundColor: textColor
        ]
        title.draw(at: CGPoint(x: margin, y: yPosition), withAttributes: attributes)
        return yPosition + 25
    }

    private func drawLabelValue(label: String, value: String, at yPosition: CGFloat) -> CGFloat {
        let labelAttributes: [NSAttributedString.Key: Any] = [
            .font: bodyFont,
            .foregroundColor: secondaryTextColor
        ]
        let valueAttributes: [NSAttributedString.Key: Any] = [
            .font: bodyFont,
            .foregroundColor: textColor
        ]

        label.draw(at: CGPoint(x: margin + 10, y: yPosition), withAttributes: labelAttributes)
        value.draw(at: CGPoint(x: margin + 180, y: yPosition), withAttributes: valueAttributes)

        return yPosition + 20
    }

    private func drawFooter(in context: UIGraphicsPDFRendererContext) {
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium
        dateFormatter.timeStyle = .short

        let footerText = "Generated by LensMate on \(dateFormatter.string(from: Date()))"
        let attributes: [NSAttributedString.Key: Any] = [
            .font: captionFont,
            .foregroundColor: secondaryTextColor
        ]

        let textSize = footerText.size(withAttributes: attributes)
        let x = (pageWidth - textSize.width) / 2
        let y = pageHeight - margin + 10

        footerText.draw(at: CGPoint(x: x, y: y), withAttributes: attributes)
    }

    /// Generate report and return URL to temporary file
    func generateReportFile(from report: WearReport) throws -> URL {
        let data = generateReport(from: report)

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let fileName = "LensMate_Report_\(dateFormatter.string(from: Date())).pdf"

        let tempDirectory = FileManager.default.temporaryDirectory
        let fileURL = tempDirectory.appendingPathComponent(fileName)

        try data.write(to: fileURL)
        return fileURL
    }
}
