import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../api-client.service';
import { EntryKind, LedgerEntry, LedgerState, Vehicle, VehicleReminder } from './ledger.models';

const STORE_KEY = 'drivvo.ledger.v1';
const demoState: LedgerState = {
  vehicles: [{ id: 'vehicle-corolla', name: 'My car', make: 'Toyota', model: 'Corolla', year: 2022, odometer: 52051, plate: 'DGV 248' }],
  entries: [
    { id: 'entry-1', vehicleId: 'vehicle-corolla', kind: 'fuel', title: 'Gasoline', amount: 36.02, odometer: 52051, date: '2026-09-01', note: '10.82 gal · $3.33/gal' },
    { id: 'entry-2', vehicleId: 'vehicle-corolla', kind: 'income', title: 'Distribution Center → Customer', amount: 76, odometer: 52018, date: '2026-08-30', note: '47 mi' },
    { id: 'entry-3', vehicleId: 'vehicle-corolla', kind: 'income', title: 'Transport application', amount: 490, odometer: 51963, date: '2026-08-29', note: 'Trip income' },
    { id: 'entry-4', vehicleId: 'vehicle-corolla', kind: 'service', title: 'Oil change', amount: 85, odometer: 51902, date: '2026-08-26', note: 'Auto Repair Shop' },
    { id: 'entry-5', vehicleId: 'vehicle-corolla', kind: 'expense', title: 'Parking +1', amount: 20, odometer: 51922, date: '2026-08-27', note: 'Parking' },
    { id: 'entry-6', vehicleId: 'vehicle-corolla', kind: 'fuel', title: 'Gasoline', amount: 42.18, odometer: 51881, date: '2026-08-25', note: '12.3 gal · $3.43/gal' },
    { id: 'entry-7', vehicleId: 'vehicle-corolla', kind: 'expense', title: 'Tire pressure check', amount: 12, odometer: 51812, date: '2026-08-21', note: 'Tire care' },
  ],
  reminders: [
    { id: 'reminder-1', vehicleId: 'vehicle-corolla', title: 'Oil change', dueOdometer: 52178, done: false },
    { id: 'reminder-2', vehicleId: 'vehicle-corolla', title: 'Insurance', dueDate: '2026-09-27', done: false },
    { id: 'reminder-3', vehicleId: 'vehicle-corolla', title: 'Tires - Pressure', dueDate: '2026-10-03', done: false },
    { id: 'reminder-4', vehicleId: 'vehicle-corolla', title: 'Vehicle inspection', dueDate: '2026-10-24', done: false },
  ],
};

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private api = inject(ApiClient);
  private state: LedgerState = this.load();

  get vehicles(): Vehicle[] { return this.state.vehicles; }
  get entries(): LedgerEntry[] { return this.state.entries; }
  get reminders(): VehicleReminder[] { return this.state.reminders; }
  get apiEnabled(): boolean { return this.api.enabled; }

  async initialize(): Promise<void> {
    if (!this.api.enabled) return;
    const [vehicles, entries, reminders] = await Promise.all([
      this.api.get<{ vehicles: Array<Omit<Vehicle, 'id'> & { id: number | string }> }>('/vehicles'),
      this.api.get<{ entries: Array<Omit<LedgerEntry, 'id' | 'vehicleId'> & { id: number | string; vehicleId: number | string }> }>('/entries'),
      this.api.get<{ reminders: Array<Omit<VehicleReminder, 'id' | 'vehicleId' | 'done'> & { id: number | string; vehicleId: number | string; done: boolean | number }> }>('/reminders'),
    ]);
    this.state = {
      vehicles: vehicles.vehicles.map((vehicle) => ({ ...vehicle, id: String(vehicle.id), year: Number(vehicle.year), odometer: Number(vehicle.odometer) })),
      entries: entries.entries.map((entry) => ({ ...entry, id: String(entry.id), vehicleId: String(entry.vehicleId), amount: Number(entry.amount), odometer: Number(entry.odometer) })),
      reminders: reminders.reminders.map((reminder) => ({ ...reminder, id: String(reminder.id), vehicleId: String(reminder.vehicleId), dueOdometer: reminder.dueOdometer === null ? undefined : Number(reminder.dueOdometer), done: Boolean(reminder.done) })),
    };
  }

  async addEntry(entry: Omit<LedgerEntry, 'id'>): Promise<void> {
    if (this.api.enabled) {
      const response = await this.api.post<{ entry: LedgerEntry }>('/entries', { ...entry, vehicleId: Number(entry.vehicleId) });
      this.state.entries = [{ ...response.entry, id: String(response.entry.id), vehicleId: String(response.entry.vehicleId), amount: Number(response.entry.amount) }, ...this.state.entries];
      const vehicle = this.state.vehicles.find((item) => item.id === entry.vehicleId);
      if (vehicle && entry.odometer > vehicle.odometer) vehicle.odometer = entry.odometer;
      return;
    }
    this.state.entries = [{ ...entry, id: crypto.randomUUID() }, ...this.state.entries];
    const vehicle = this.state.vehicles.find((item) => item.id === entry.vehicleId);
    if (vehicle && entry.odometer > vehicle.odometer) vehicle.odometer = entry.odometer;
    this.save();
  }

  async updateEntry(entry: LedgerEntry): Promise<void> {
    if (this.api.enabled) {
      const response = await this.api.patch<{ entry: LedgerEntry }>(`/entries/${entry.id}`, { ...entry, vehicleId: Number(entry.vehicleId) });
      this.state.entries = this.state.entries.map((item) => item.id === entry.id ? { ...response.entry, id: String(response.entry.id), vehicleId: String(response.entry.vehicleId), amount: Number(response.entry.amount) } : item);
      return;
    }
    this.state.entries = this.state.entries.map((item) => item.id === entry.id ? entry : item);
    this.save();
  }

  async addReminder(reminder: Omit<VehicleReminder, 'id' | 'done'>): Promise<void> {
    if (this.api.enabled) {
      const response = await this.api.post<{ reminder: VehicleReminder }>('/reminders', { ...reminder, vehicleId: Number(reminder.vehicleId) });
      this.state.reminders = [{ ...response.reminder, id: String(response.reminder.id), vehicleId: String(response.reminder.vehicleId) }, ...this.state.reminders];
      return;
    }
    this.state.reminders = [{ ...reminder, id: crypto.randomUUID(), done: false }, ...this.state.reminders];
    this.save();
  }

  async addVehicle(vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    if (this.api.enabled) {
      const response = await this.api.post<{ vehicle: Omit<Vehicle, 'id'> & { id: number | string } }>('/vehicles', vehicle);
      const saved = { ...response.vehicle, id: String(response.vehicle.id), year: Number(response.vehicle.year), odometer: Number(response.vehicle.odometer) };
      this.state.vehicles = [...this.state.vehicles, saved];
      return saved;
    }
    const saved = { ...vehicle, id: crypto.randomUUID() };
    this.state.vehicles = [...this.state.vehicles, saved];
    this.save();
    return saved;
  }

  async toggleReminder(id: string): Promise<void> {
    if (this.api.enabled) {
      await this.api.patch(`/reminders/${id}`, {});
    }
    this.state.reminders = this.state.reminders.map((reminder) => reminder.id === id ? { ...reminder, done: !reminder.done } : reminder);
    this.save();
  }

  getKindLabel(kind: EntryKind): string {
    return { fuel: 'Refueling', expense: 'Expense', income: 'Income', service: 'Service' }[kind];
  }

  private load(): LedgerState {
    if (this.api.enabled) return { vehicles: [], entries: [], reminders: [] };
    try {
      const stored = localStorage.getItem(STORE_KEY);
      return stored ? JSON.parse(stored) as LedgerState : structuredClone(demoState);
    } catch {
      return structuredClone(demoState);
    }
  }

  private save(): void {
    if (this.api.enabled) return;
    localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
  }
}
