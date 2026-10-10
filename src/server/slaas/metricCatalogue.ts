export type MetricPrivacy = 'public_aggregate' | 'staff_aggregate' | 'staff_identifiable';

export interface MetricDefinition {
  id: string;
  name: string;
  definition: string;
  numerator: string;
  denominator: string | null;
  unit: 'count' | 'minutes' | 'percent' | 'ratio';
  sourceTables: string[];
  privacy: MetricPrivacy;
  filters?: string[];
  exclusions?: string[];
}

export const SLAAS_METRIC_CATALOGUE: MetricDefinition[] = [
  {
    id: 'slaas.total_visits',
    name: 'Total Visits',
    definition: 'Count of all access_visits rows (checked_in, checked_out, auto_closed) in the period.',
    numerator: 'count(access_visits.id)',
    denominator: null,
    unit: 'count',
    sourceTables: ['access_visits'],
    privacy: 'staff_aggregate',
  },
  {
    id: 'slaas.unique_users',
    name: 'Unique Library Users',
    definition: 'Distinct patrons with at least one visit in the period (excludes visitors).',
    numerator: 'count(distinct access_visits.patron_id where visitor_id is null)',
    denominator: null,
    unit: 'count',
    sourceTables: ['access_visits'],
    privacy: 'staff_aggregate',
    exclusions: ['visitor visits'],
  },
  {
    id: 'slaas.avg_duration_minutes',
    name: 'Average Visit Duration',
    definition: 'Mean duration_minutes over visits with a non-null duration in the period.',
    numerator: 'sum(access_visits.duration_minutes)',
    denominator: 'count(access_visits where duration_minutes is not null)',
    unit: 'minutes',
    sourceTables: ['access_visits'],
    privacy: 'staff_aggregate',
  },
  {
    id: 'slaas.median_duration_minutes',
    name: 'Median Visit Duration',
    definition: 'Median duration_minutes over visits with a non-null duration.',
    numerator: 'median(access_visits.duration_minutes)',
    denominator: null,
    unit: 'minutes',
    sourceTables: ['access_visits'],
    privacy: 'staff_aggregate',
  },
  {
    id: 'slaas.current_occupancy',
    name: 'Current Occupancy',
    definition: 'Count of access_visits with status=checked_in for the branch.',
    numerator: 'count(access_visits where status=checked_in)',
    denominator: null,
    unit: 'count',
    sourceTables: ['access_visits'],
    privacy: 'public_aggregate',
  },
  {
    id: 'slaas.peak_occupancy',
    name: 'Peak Occupancy',
    definition: 'Max concurrent checked-in visits observed in the period.',
    numerator: 'max(concurrent checked_in)',
    denominator: null,
    unit: 'count',
    sourceTables: ['access_visits'],
    privacy: 'staff_aggregate',
  },
  {
    id: 'slaas.occupancy_pct',
    name: 'Occupancy Percentage',
    definition: 'Currently inside / branch capacity * 100.',
    numerator: 'currently_inside',
    denominator: 'branch_capacity',
    unit: 'percent',
    sourceTables: ['access_visits', 'library_branches'],
    privacy: 'public_aggregate',
  },
  {
    id: 'slaas.visitor_visits',
    name: 'Visitor Visits',
    definition: 'Count of visits with a non-null visitor_id in the period.',
    numerator: 'count(access_visits where visitor_id is not null)',
    denominator: null,
    unit: 'count',
    sourceTables: ['access_visits', 'access_visitors'],
    privacy: 'staff_aggregate',
  },
  {
    id: 'slaas.repeat_visit_rate',
    name: 'Repeat Visit Rate',
    definition: 'Unique patrons with >1 visit / unique patrons with >=1 visit.',
    numerator: 'count(distinct patron_id with >1 visit)',
    denominator: 'count(distinct patron_id)',
    unit: 'percent',
    sourceTables: ['access_visits'],
    privacy: 'staff_aggregate',
  },
  {
    id: 'slaas.avg_visits_per_user',
    name: 'Average Visits per Active User',
    definition: 'Total patron visits / unique patrons in the period.',
    numerator: 'count(visit where visitor_id is null)',
    denominator: 'count(distinct patron_id)',
    unit: 'ratio',
    sourceTables: ['access_visits'],
    privacy: 'staff_aggregate',
  },
];

export function getMetricById(id: string): MetricDefinition | undefined {
  return SLAAS_METRIC_CATALOGUE.find((m) => m.id === id);
}
