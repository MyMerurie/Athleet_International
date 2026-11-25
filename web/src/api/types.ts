export type AppModule =
  | 'DASHBOARD' | 'STUDENT' | 'CENTER' | 'ROLE' | 'STAFF' | 'REPORTS' | 'REQUEST' | 'EXPENSE'
  | 'MESSAGING' | 'POSTS' | 'ASSESSMENT' | 'COACHING_DRILLS' | 'SETTINGS' | 'ATTENDANCE' | 'ATTENDANCE_APPROVAL';
export type AccessLevel = 'NONE' | 'VIEW' | 'MANAGE';
export type RoleType = 'HEAD_OFFICE' | 'CENTER' | 'STUDENT';
export type ActiveStatus = 'ACTIVE' | 'INACTIVE';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type StudentStatus = 'ACTIVE' | 'SUBMITTED' | 'DEREGISTERED';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export const MODULES: { key: AppModule; label: string }[] = [
  { key: 'DASHBOARD', label: 'Dashboard' },
  { key: 'STUDENT', label: 'Student' },
  { key: 'ATTENDANCE', label: 'Attendance (mark)' },
  { key: 'ATTENDANCE_APPROVAL', label: 'Attendance (approve)' },
  { key: 'CENTER', label: 'Class' },
  { key: 'ROLE', label: 'Roles' },
  { key: 'STAFF', label: 'Staff' },
  { key: 'REPORTS', label: 'Reports' },
  { key: 'REQUEST', label: 'Request' },
  { key: 'EXPENSE', label: 'Expense' },
  { key: 'MESSAGING', label: 'Messaging' },
  { key: 'POSTS', label: 'Posts' },
  { key: 'ASSESSMENT', label: 'Assessment' },
  { key: 'COACHING_DRILLS', label: 'Coaching Drills' },
  { key: 'SETTINGS', label: 'Settings' },
];

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface Me {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  platformAdmin: boolean;
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  user: Me;
}

export interface AccessibleOrganization {
  id: string;
  name: string;
  city?: string;
  country?: string;
  primary: boolean;
  affiliates?: AccessibleOrganization[];
}

export interface Organization {
  id: string;
  parentId?: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  email?: string;
  phone?: string;
  sport?: string;
  status: string;
  centerLabel: string;
  currency: string;
  dateFormat: string;
}

export interface MyAccess {
  organization: Organization;
  permissions: Partial<Record<AppModule, AccessLevel>>;
  centerId?: string;
  affiliateCount: number;
}

export interface RoleSummary {
  id: string;
  name: string;
  roleType: RoleType;
  systemRole: boolean;
}

export interface Role extends RoleSummary {
  permissions: Partial<Record<AppModule, AccessLevel>>;
}

export interface Staff {
  membershipId: string;
  userId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  countryCode?: string;
  mobile?: string;
  roleId: string;
  roleName: string;
  roleType: RoleType;
  centerId?: string;
  status: 'ACTIVE' | 'DEREGISTERED';
  dateOfJoining?: string;
  qualifications?: string;
  profile?: string;
  passwordSet: boolean;
}

export interface Option {
  id: string;
  name: string;
  parentId?: string;
}

export interface CenterSummary {
  id: string;
  name: string;
  status: ActiveStatus;
  city?: string;
  country?: string;
  batches: number;
  students: number;
  capacity: number;
}

export interface Center {
  id: string;
  name: string;
  code?: string;
  contactName?: string;
  contactCountryCode?: string;
  contactPhone?: string;
  contactEmail?: string;
  sport?: string;
  facilityType?: string;
  facilityCount?: number;
  status: ActiveStatus;
  country?: string;
  state?: string;
  city?: string;
  address1?: string;
  address2?: string;
  zipcode?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusM: number;
}

export interface Slot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface Batch {
  id: string;
  centerId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  slots: Slot[];
  coaches: { userId: string; name: string }[];
  capacity: number;
  status: ActiveStatus;
  description?: string;
  students: number;
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface StudentSummary {
  id: string;
  studentNo: number;
  firstName: string;
  lastName?: string;
  center: NamedRef;
  batches: NamedRef[];
  age?: number;
  grade?: string;
  email?: string;
  status: StudentStatus;
}

export interface Student {
  id: string;
  studentNo: number;
  center: NamedRef;
  batches: NamedRef[];
  firstName: string;
  lastName?: string;
  email?: string;
  gender: Gender;
  dateOfBirth: string;
  age?: number;
  countryCode?: string;
  mobile?: string;
  uniqueId?: string;
  bloodGroup?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  pinCode?: string;
  schoolName?: string;
  schoolAddress?: string;
  grade?: string;
  dominantSide?: 'LEFT' | 'RIGHT' | 'BOTH';
  medicalCondition?: string;
  kitSize?: string;
  contacts: StudentContact[];
  tags: string[];
  status: StudentStatus;
}

export interface StudentConfig {
  uniqueIdAuto: boolean;
  uniqueIdPrefix: string;
}

export interface TransferTarget {
  id: string;
  name: string;
  centers: { id: string; name: string; batches: NamedRef[] }[];
}

export type InjurySeverity = 'MINOR' | 'MODERATE' | 'SEVERE';

export interface Injury {
  id: string;
  injuryDate: string;
  bodyPart: string;
  severity: InjurySeverity;
  description?: string;
  recoveredOn?: string;
}

export type HistoryEventType =
  | 'REGISTERED' | 'APPROVED' | 'PLACEMENT_CHANGED' | 'TRANSFERRED' | 'DEACTIVATED' | 'REACTIVATED' | 'DEREGISTERED';

export interface HistoryEvent {
  id: string;
  eventType: HistoryEventType;
  occurredAt: string;
  actorName?: string;
  fromAcademy?: string;
  toAcademy?: string;
  fromCenter?: string;
  toCenter?: string;
  fromBatches?: string;
  toBatches?: string;
}

export interface StudentContact {
  name: string;
  relationship?: string;
  countryCode?: string;
  mobile: string;
  email?: string;
}

export interface TrainingDay {
  batch: NamedRef;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface StudentProfile {
  student: Student;
  trainingDays: TrainingDay[];
}

export interface HeadcountRow {
  id: string;
  name: string;
  male: number;
  female: number;
  other: number;
  total: number;
}

export interface UtilizationRow {
  id: string;
  name: string;
  students: number;
  capacity: number;
  utilization: number;
}

export interface GeneralDashboard {
  totalStudents: number;
  totalCenters: number;
  totalBatches: number;
  totalCapacity: number;
  male: number;
  female: number;
  other: number;
  ageBuckets: Record<string, number>;
  groupedBy: 'ACADEMY' | 'CENTER';
  headcount: HeadcountRow[];
  utilization: UtilizationRow[];
}

// ---- attendance ----

export type SessionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED';
export type MarkStatus = 'PRESENT' | 'ABSENT';

export interface AttendanceConfig {
  selfieRequired: boolean;
  tasksOnOut: boolean;
  showDeviceInfo: boolean;
  allowDateOverride: boolean;
  maxBackDays: number;
  maxForwardDays: number;
}

export interface SessionBatch {
  batchId: string;
  batchName: string;
  centerId: string;
  centerName: string;
  sessionId?: string;
  status?: SessionStatus;
  present: number;
  absent: number;
  total: number;
}

export interface SessionMark {
  studentId: string;
  studentNo: number;
  studentName: string;
  status?: MarkStatus;
  remark?: string;
}

export interface SessionDetail {
  id?: string;
  version?: number;
  centerId: string;
  batchId: string;
  batchName: string;
  date: string;
  status?: SessionStatus;
  reviewReason?: string;
  editable: boolean;
  canSubmit: boolean;
  canReview: boolean;
  marks: SessionMark[];
}

export interface SessionSummary {
  id: string;
  version: number;
  centerId: string;
  centerName: string;
  batchId: string;
  batchName: string;
  date: string;
  status: SessionStatus;
  present: number;
  absent: number;
  unmarked: number;
}

export interface Shift {
  id: string;
  version: number;
  userId: string;
  staffName: string;
  centerId?: string;
  centerName?: string;
  batchId?: string;
  batchName?: string;
  workDate: string;
  inAt: string;
  outAt?: string;
  source: string;
  inDistanceM?: number;
  inOutsideGeofence?: boolean;
  outDistanceM?: number;
  outOutsideGeofence?: boolean;
  hasInSelfie: boolean;
  hasOutSelfie: boolean;
  tasks?: string;
  deviceId?: string;
  phoneType?: string;
  corrected: boolean;
}

export interface ShiftDetail {
  shift: Shift;
  inSelfieUrl?: string;
  outSelfieUrl?: string;
  correctionReason?: string;
}

export interface MyDay {
  date: string;
  config: AttendanceConfig;
  openShift?: Shift;
  shifts: Shift[];
}

export interface LiveStaffRow {
  userId: string;
  name: string;
  status: 'IN' | 'OUT' | 'NOT_IN';
  inAt?: string;
  outAt?: string;
  batchName?: string;
  outsideGeofence?: boolean;
  deviceId?: string;
  phoneType?: string;
}

export interface LiveSessionRow {
  batchId: string;
  batchName: string;
  coaches: string[];
  status?: SessionStatus;
  present: number;
  absent: number;
  total: number;
}

export interface LiveGroup {
  id: string;
  name: string;
  staff: LiveStaffRow[];
  sessions: LiveSessionRow[];
}

export interface LiveAttendance {
  date: string;
  groupedBy: string;
  groups: LiveGroup[];
}

export interface TrackerCell {
  date: string;
  code?: string;
  pending: boolean;
  inAt?: string;
  outAt?: string;
  outsideGeofence?: boolean;
}

export interface TrackerRow {
  id: string;
  name: string;
  subtitle?: string;
  cells: TrackerCell[];
  present: number;
  absent: number;
  percent: number;
}

export interface TrackerGrid {
  type: 'STAFF' | 'STUDENT';
  from: string;
  to: string;
  days: string[];
  rows: TrackerRow[];
  page: number;
  size: number;
  total: number;
}

export interface StudentDay {
  date: string;
  batchName: string;
  status?: MarkStatus;
  sessionStatus?: SessionStatus;
}

export interface StudentMonth {
  studentId: string;
  studentName: string;
  month: string;
  present: number;
  absent: number;
  percent: number;
  days: StudentDay[];
}

export interface FileResponse {
  id: string;
}
