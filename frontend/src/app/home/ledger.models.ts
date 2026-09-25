export type EntryKind = 'fuel' | 'expense' | 'income' | 'service';
export type LedgerTab = 'history' | 'reports' | 'reminders';

export interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  odometer: number;
  plate: string;
}

export interface LedgerEntry {
  id: string;
  vehicleId: string;
  kind: EntryKind;
  title: string;
  amount: number;
  odometer: number;
  date: string;
  note?: string;
}

export interface VehicleReminder {
  id: string;
  vehicleId: string;
  title: string;
  dueDate?: string;
  dueOdometer?: number;
  done: boolean;
}

export interface LedgerState {
  vehicles: Vehicle[];
  entries: LedgerEntry[];
  reminders: VehicleReminder[];
}
