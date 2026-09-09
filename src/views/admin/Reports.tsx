import { useState } from 'react';
import { institutionConfig } from '@config/institution.config';

interface ComplianceItem {
  name: string;
  currentValue: number;
  benchmark: number;
  unit: string;
  status: 'met' | 'partial' | 'unmet';
}

interface ComplianceSection {
  title: string;
  items: ComplianceItem[];
}

export default function Reports() {
  const [scheduleMonthly, setScheduleMonthly] = useState(true);

  const getRegulatoryDashboard = (): { title: string; sections: ComplianceSection[] } => {
    if (institutionConfig.regulatoryBody === 'NUC') {
      return {
        title: 'NUC BMAS Compliance Dashboard',
        sections: [
          {
            title: 'Section A: Physical Infrastructure',
            items: [
              {
                name: 'Building Space',
                currentValue: 450,
                benchmark: 400,
                unit: 'sq. meters',
                status: 'met',
              },
              {
                name: 'Seating Capacity',
                currentValue: 120,
                benchmark: 100,
                unit: 'seats',
                status: 'met',
              },
              {
                name: 'Computer Terminals',
                currentValue: 25,
                benchmark: 30,
                unit: 'units',
                status: 'partial',
              },
            ],
          },
          {
            title: 'Section B: Collections & Resources',
            items: [
              {
                name: 'Print Books',
                currentValue: 15000,
                benchmark: 12000,
                unit: 'volumes',
                status: 'met',
              },
              {
                name: 'E-journals Access',
                currentValue: 850,
                benchmark: 1000,
                unit: 'titles',
                status: 'partial',
              },
              {
                name: 'Databases Licensed',
                currentValue: 45,
                benchmark: 50,
                unit: 'databases',
                status: 'partial',
              },
            ],
          },
          {
            title: 'Section C: Digital Infrastructure',
            items: [
              {
                name: 'OPAC Availability',
                currentValue: 99.8,
                benchmark: 99,
                unit: '%',
                status: 'met',
              },
              {
                name: 'Digital Repository Size',
                currentValue: 2500,
                benchmark: 2000,
                unit: 'items',
                status: 'met',
              },
              {
                name: 'Mobile App Downloads',
                currentValue: 8500,
                benchmark: 5000,
                unit: 'downloads',
                status: 'met',
              },
            ],
          },
          {
            title: 'Section D: Human Resources',
            items: [
              {
                name: 'Professional Librarians',
                currentValue: institutionConfig.totalStaff || 8,
                benchmark: 5,
                unit: 'staff',
                status: 'met',
              },
              {
                name: 'Support Staff',
                currentValue: 12,
                benchmark: 10,
                unit: 'staff',
                status: 'met',
              },
              {
                name: 'Staff with Advanced Degrees',
                currentValue: 6,
                benchmark: 4,
                unit: 'staff',
                status: 'met',
              },
            ],
          },
          {
            title: 'Section E: Services & Programs',
            items: [
              {
                name: 'User Education Sessions',
                currentValue: 24,
                benchmark: 12,
                unit: 'sessions/year',
                status: 'met',
              },
              {
                name: 'Reference Inquiries Handled',
                currentValue: 1850,
                benchmark: 1500,
                unit: 'inquiries/year',
                status: 'met',
              },
              {
                name: 'Interlibrary Loans Processed',
                currentValue: 420,
                benchmark: 300,
                unit: 'loans/year',
                status: 'met',
              },
            ],
          },
          {
            title: 'Section F: Budget & Funding',
            items: [
              {
                name: 'Total Budget',
                currentValue: 85000,
                benchmark: 75000,
                unit: 'NGN thousands',
                status: 'met',
              },
              {
                name: 'Books & Materials %',
                currentValue: 45,
                benchmark: 40,
                unit: '%',
                status: 'met',
              },
              {
                name: 'Staff Development Budget',
                currentValue: 12,
                benchmark: 10,
                unit: '%',
                status: 'met',
              },
            ],
          },
        ],
      };
    }

    return {
      title: 'Regulatory Compliance Report',
      sections: [
        {
          title: 'General Metrics',
          items: [
            {
              name: 'Total Enrolment',
              currentValue: institutionConfig.totalEnrolment || 5000,
              benchmark: 4000,
              unit: 'students',
              status: 'met',
            },
            {
              name: 'Library Staff',
              currentValue: institutionConfig.totalStaff || 15,
              benchmark: 10,
              unit: 'staff',
              status: 'met',
            },
          ],
        },
      ],
    };
  };

  const regulatoryData = getRegulatoryDashboard();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'met':
        return 'text-green-600';
      case 'partial':
        return 'text-yellow-600';
      case 'unmet':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'met':
        return 'badge-success';
      case 'partial':
        return 'badge-warning';
      case 'unmet':
        return 'badge-error';
      default:
        return 'badge-secondary';
    }
  };

  const exportPDF = () => {
    console.log('Exporting PDF report...');
  };

  const exportExcel = () => {
    const data = regulatoryData.sections.flatMap((section) =>
      section.items.map((item) => ({
        Section: section.title,
        Metric: item.name,
        'Current Value': item.currentValue,
        Benchmark: item.benchmark,
        Unit: item.unit,
        Status: item.status,
      }))
    );

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((header) => `"${row[header as keyof typeof row]}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compliance_report.csv';
    a.click();
  };

  const exportWord = () => {
    console.log('Exporting Word document...');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{regulatoryData.title}</h1>
          <p className="text-gray-600 mt-2">
            Regulatory body: {institutionConfig.regulatoryBody || 'NUC'}
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={exportPDF} className="btn-outline">
            📄 PDF
          </button>
          <button onClick={exportExcel} className="btn-outline">
            📊 Excel
          </button>
          <button onClick={exportWord} className="btn-outline">
            📝 Word
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <label className="label">Schedule Monthly Delivery</label>
            <p className="text-sm text-gray-600">Auto-generate and send reports every month</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleMonthly}
              onChange={(e) => setScheduleMonthly(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
          </label>
        </div>
      </div>

      {regulatoryData.sections.map((section, sectionIdx) => (
        <div key={sectionIdx} className="card">
          <h2 className="text-xl font-semibold mb-6">{section.title}</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-semibold">Metric</th>
                  <th className="text-left p-3 font-semibold">Current Value</th>
                  <th className="text-left p-3 font-semibold">Benchmark</th>
                  <th className="text-left p-3 font-semibold">Unit</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, itemIdx) => (
                  <tr key={itemIdx} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 font-semibold">{item.currentValue}</td>
                    <td className="p-3">{item.benchmark}</td>
                    <td className="p-3 text-gray-600">{item.unit}</td>
                    <td className="p-3">
                      <span className={`badge ${getStatusBadge(item.status)}`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-green-50 rounded">
                <p className="text-green-600 font-semibold">
                  {section.items.filter((i) => i.status === 'met').length} Met
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded">
                <p className="text-yellow-600 font-semibold">
                  {section.items.filter((i) => i.status === 'partial').length} Partial
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded">
                <p className="text-red-600 font-semibold">
                  {section.items.filter((i) => i.status === 'unmet').length} Unmet
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="card bg-primary-50 border border-primary-200">
        <h3 className="text-lg font-semibold mb-4">Overall Compliance Summary</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-700">Compliance Percentage</p>
            <p className="text-3xl font-bold text-green-600">87%</p>
          </div>
          <div>
            <p className="text-sm text-gray-700">Last Updated</p>
            <p className="text-lg font-semibold">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-700">Next Review</p>
            <p className="text-lg font-semibold">30 days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
