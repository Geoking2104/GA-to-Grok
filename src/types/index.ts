export interface GA4Property {
  propertyId: string;
  displayName: string;
  accountId?: string;
  timeZone?: string;
  currencyCode?: string;
}

export interface ReportRequest {
  propertyId: string;
  metrics: string[];
  dimensions?: string[];
  startDate: string;
  endDate: string;
  dimensionFilter?: any;
  metricFilter?: any;
  orderBys?: any[];
  limit?: number;
  keepEmptyRows?: boolean;
}

export interface ReportRow {
  dimensionValues: string[];
  metricValues: string[];
}
