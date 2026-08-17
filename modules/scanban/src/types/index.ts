export type OrderStatus = 'DRAFT' | 'PARSED' | 'SCANNING' | 'VERIFIED' | 'CLOSED' | 'PARTIAL_DISPATCH' | 'READY';

export type ItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVER_SCANNED';

export type ScanResult = 'SUCCESS' | 'UNMATCHED_CODE' | 'EXCESS_QUANTITY';

export interface OrderItem {
  id: string;
  orderId: string;
  code: string; // EAN-13 o SKU interno
  description: string;
  quantityRequired: number;
  quantityScanned: number;
  unitPrice?: number;
  status: ItemStatus;
}

export interface Order {
  id: string;
  orderNumber: string;
  clientName: string;
  issueDate: string;
  pdfFileName: string;
  status: OrderStatus;
  createdAt: string;
  closedAt?: string;
  totalItemsRequired: number;
  totalItemsScanned: number;
  items: OrderItem[];
  exceptionReason?: string;
  supervisorPin?: string;
  auditStamp?: string;
  operatorEmail?: string;
}

export interface ScanLog {
  id: string;
  orderId: string;
  barcodeScanned: string;
  timestamp: string;
  result: ScanResult;
  matchedItemId?: string;
}
