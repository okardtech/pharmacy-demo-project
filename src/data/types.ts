export type Bi = { lo: string; en: string };

export type Role =
  | 'SUPER_ADMIN'
  | 'MINISTRY_ADMIN'
  | 'PROVINCIAL_OFFICER'
  | 'INSPECTOR'
  | 'PHARMACY_OWNER'
  | 'PHARMACIST'
  | 'STAFF';

export const REGULATOR_ROLES: Role[] = ['SUPER_ADMIN', 'MINISTRY_ADMIN', 'PROVINCIAL_OFFICER', 'INSPECTOR'];

export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  deletedAt?: string | null;
}

export interface Province { id: string; code: string; name: Bi; lat: number; lng: number }
export interface District { id: string; provinceId: string; name: Bi }

export type PharmacyType = 'PHARMACY' | 'DRUG_STORE' | 'CLINIC_DISPENSARY';
export type PharmacyStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'CLOSED';
export type LicenseStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'RENEWAL_PENDING' | 'REVOKED';

export interface PharmacyLicense { number: string; issueDate: string; expiryDate: string; revoked?: boolean }

export interface Pharmacy extends Base {
  code: string;
  name: Bi;
  type: PharmacyType;
  provinceId: string;
  districtId: string;
  village: string;
  phone: string;
  owner: Bi;
  pharmacist: Bi;
  lat: number;
  lng: number;
  status: PharmacyStatus;
  license: PharmacyLicense;
  complianceScore: number;
}

export type DrugCategory = 'GENERAL' | 'PRESCRIPTION_ONLY' | 'CONTROLLED' | 'DANGEROUS';
export type DrugStatus = 'APPROVED' | 'BANNED' | 'RECALLED';

export interface Drug extends Base {
  generic: string;
  brand: string;
  strength: string;
  form: string;
  packSize: string;
  category: DrugCategory;
  regNo: string;
  manufacturer: string;
  importer: string;
  barcode: string;
  status: DrugStatus;
  ingredients: string[];
  refPrice: number;
}

export interface Supplier extends Base {
  pharmacyId: string;
  name: string;
  contact: string;
  phone: string;
  licenseNo: string;
  paymentTerms: string;
}

export interface Batch extends Base {
  pharmacyId: string;
  drugId: string;
  lot: string;
  mfgDate: string;
  expiryDate: string;
  cost: number;
  price: number;
}

export type MovementType = 'RECEIVE' | 'SALE' | 'RETURN_IN' | 'RETURN_OUT' | 'ADJUST' | 'TRANSFER' | 'DESTROY';

export interface StockMovement extends Base {
  pharmacyId: string;
  batchId: string;
  drugId: string;
  type: MovementType;
  qty: number;
  ref: string;
  reason?: string;
  device: string;
  at: string;
}

export interface SaleLine { drugId: string; batchId: string; qty: number; price: number; cost: number }
export type PaymentMethod = 'CASH' | 'BANK' | 'QR';

export interface Sale extends Base {
  pharmacyId: string;
  receiptNo: string;
  at: string;
  cashier: string;
  method: PaymentMethod;
  lines: SaleLine[];
  subtotal: number;
  discount: number;
  total: number;
  customerId?: string;
  prescriptionId?: string;
  pendingVerification?: boolean;
}

export interface Customer extends Base {
  pharmacyId: string;
  name: string;
  phone: string;
  allergies: string[];
}

export interface Prescription extends Base {
  pharmacyId: string;
  doctorName: string;
  doctorLicense: string;
  facility: string;
  patientName: string;
  patientAge: number;
  patientSex: 'M' | 'F';
  patientIdNo: string;
  date: string;
  hasPhoto: boolean;
  saleId?: string;
  drugIds: string[];
}

export interface GoodsReceipt extends Base {
  pharmacyId: string;
  supplierId: string;
  invoiceNo: string;
  at: string;
  total: number;
  lineCount: number;
  hasPhoto: boolean;
}

export interface Destruction extends Base {
  pharmacyId: string;
  date: string;
  method: string;
  witnesses: string[];
  items: { batchId: string; drugId: string; qty: number }[];
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
}

export interface AdrReport extends Base {
  pharmacyId: string;
  patientInitials: string;
  patientAge: number;
  drugId: string;
  batchLot: string;
  reaction: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'FATAL';
  outcome: 'RECOVERED' | 'RECOVERING' | 'NOT_RECOVERED' | 'UNKNOWN';
  reporter: string;
  date: string;
}

export interface RenewalRequest extends Base {
  pharmacyId: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes: string;
  decisionNotes?: string;
  reviewedBy?: string;
  documents: string[];
}

export interface DocumentFile extends Base {
  pharmacyId: string;
  type: 'LICENSE' | 'PHARMACIST_CERT' | 'FLOOR_PLAN' | 'ID_CARD' | 'OTHER';
  fileName: string;
  sizeKb: number;
}

export interface ChecklistItem { id: string; q: Bi; evidence: Bi; weight: number; critical: boolean }
export interface ChecklistSection { id: string; title: Bi; items: ChecklistItem[] }
export interface InspectionTemplate { id: string; name: Bi; version: number; sections: ChecklistSection[] }

export type Answer = 'YES' | 'NO' | 'NA';
export type InspectionResult = 'PASS' | 'PASS_WITH_CONDITIONS' | 'FAIL';

export interface Inspection extends Base {
  pharmacyId: string;
  inspectorIds: string[];
  date: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  templateId: string;
  answers: Record<string, Answer>;
  notes: Record<string, string>;
  photos: Record<string, number>;
  score?: number;
  result?: InspectionResult;
  checkIn?: { lat: number; lng: number; at: string };
  signedByInspector?: boolean;
  signedByPharmacy?: boolean;
}

export interface CorrectiveAction extends Base {
  pharmacyId: string;
  inspectionId: string;
  finding: Bi;
  action: Bi;
  deadline: string;
  status: 'OPEN' | 'SUBMITTED' | 'VERIFIED' | 'OVERDUE';
  evidenceNote?: string;
}

export interface MonthlyStat {
  pharmacyId: string;
  month: string; // YYYY-MM
  sales: number;
  controlledUnits: number;
  prescriptions: number;
}

export type ReportType = 'CONTROLLED' | 'PRESCRIPTIONS' | 'DESTRUCTION' | 'ADR';
export interface RegulatoryReport extends Base {
  pharmacyId: string;
  month: string;
  type: ReportType;
  status: 'SUBMITTED' | 'LATE' | 'MISSING' | 'DRAFT';
  submittedAt?: string;
}

export interface User extends Base {
  username: string;
  phone: string;
  name: Bi;
  role: Role;
  provinceId?: string;
  pharmacyId?: string;
  active: boolean;
  twoFactor: boolean;
  lastLogin?: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'APPROVE' | 'REJECT';
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  device: string;
  ip: string;
}

export interface Notification {
  id: string;
  at: string;
  recipient: 'pharmacy' | 'regulator' | 'all';
  type: 'LICENSE' | 'RECALL' | 'STOCK' | 'INSPECTION' | 'SYNC' | 'REPORT';
  title: Bi;
  body: Bi;
  link: string;
  read: boolean;
}

export interface Db {
  provinces: Province[];
  districts: District[];
  pharmacies: Pharmacy[];
  drugs: Drug[];
  suppliers: Supplier[];
  batches: Batch[];
  movements: StockMovement[];
  sales: Sale[];
  customers: Customer[];
  prescriptions: Prescription[];
  receipts: GoodsReceipt[];
  destructions: Destruction[];
  adrs: AdrReport[];
  renewals: RenewalRequest[];
  documents: DocumentFile[];
  inspections: Inspection[];
  corrective: CorrectiveAction[];
  reports: RegulatoryReport[];
  users: User[];
}

export type Collection = keyof Db;
