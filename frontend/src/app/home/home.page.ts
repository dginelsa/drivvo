import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { EntryKind, LedgerEntry, LedgerTab, Vehicle } from './ledger.models';
import { LedgerService } from './ledger.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  public ledger = inject(LedgerService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  readonly today = new Date();
  readonly entryKinds: Array<{ value: EntryKind; label: string; icon: string }> = [
    { value: 'fuel', label: 'Refueling', icon: 'flame-outline' },
    { value: 'expense', label: 'Expense', icon: 'card-outline' },
    { value: 'income', label: 'Income', icon: 'trending-up-outline' },
    { value: 'service', label: 'Service', icon: 'construct-outline' },
  ];
  activeTab: LedgerTab = 'history';
  selectedVehicleId = this.ledger.vehicles[0]?.id ?? '';
  modalOpen = false;
  formError = '';
  editingEntryId: string | null = null;
  entryKind: EntryKind = 'fuel';
  title = '';
  amount = '';
  odometer = '';
  date = new Date().toISOString().slice(0, 10);
  note = '';
  vehicleModalOpen = false;
  vehicleName = '';
  vehicleMake = '';
  vehicleModel = '';
  vehicleYear = new Date().getFullYear();
  vehicleOdometer = '';
  reminderModalOpen = false;
  reminderTitle = '';
  reminderDate = '';
  reminderOdometer = '';
  reportRange = 'This year';
  isLoading = true;
  loadError = '';

  async ngOnInit(): Promise<void> {
    try {
      await this.ledger.initialize();
      this.selectedVehicleId = this.ledger.vehicles[0]?.id ?? '';
    } catch {
      this.loadError = 'Your garage could not be loaded. Check your connection and sign in again.';
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  get selectedVehicle(): Vehicle | undefined {
    return this.ledger.vehicles.find((vehicle) => vehicle.id === this.selectedVehicleId);
  }

  get visibleEntries(): LedgerEntry[] {
    return this.ledger.entries.filter((entry) => entry.vehicleId === this.selectedVehicleId);
  }

  get visibleReminders() {
    return this.ledger.reminders.filter((reminder) => reminder.vehicleId === this.selectedVehicleId && !reminder.done);
  }

  get thisMonthEntries(): LedgerEntry[] {
    const month = new Date().toISOString().slice(0, 7);
    return this.visibleEntries.filter((entry) => entry.date.startsWith(month));
  }

  get monthlyFuelTotal(): number {
    return this.thisMonthEntries.filter((entry) => entry.kind === 'fuel').reduce((sum, entry) => sum + entry.amount, 0);
  }

  get fuelCount(): number { return this.thisMonthEntries.filter((entry) => entry.kind === 'fuel').length; }

  get monthlyBalance(): number {
    return this.thisMonthEntries.reduce((sum, entry) => sum + (entry.kind === 'income' ? entry.amount : -entry.amount), 0);
  }

  get totalIncome(): number {
    return this.reportEntries.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  }

  get totalOutgoings(): number {
    return this.reportEntries.filter((entry) => entry.kind !== 'income').reduce((sum, entry) => sum + entry.amount, 0);
  }

  get reportEntries(): LedgerEntry[] {
    if (this.reportRange === 'All time') return this.visibleEntries;
    const now = new Date();
    const start = this.reportRange === 'This year'
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);
    return this.visibleEntries.filter((entry) => entry.date >= startDate && entry.date <= endDate);
  }

  get reportChartCaption(): string {
    return `Monthly totals · ${this.reportRange === 'All time' ? 'last 12 months' : this.reportRange}`;
  }

  get nextReminderTitle(): string { return this.visibleReminders[0]?.title ?? 'All caught up'; }

  get nextReminderDescription(): string {
    const reminder = this.visibleReminders[0];
    return reminder ? this.reminderDue(reminder) : 'No upcoming maintenance';
  }

  get categoryTotals() {
    return (['fuel', 'expense', 'income', 'service'] as EntryKind[]).map((kind) => ({
      kind,
      label: this.ledger.getKindLabel(kind),
      amount: this.reportEntries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0),
    }));
  }

  get bars() {
    const now = new Date();
    const monthCount = this.reportRange === 'This year' ? now.getMonth() + 1 : this.reportRange === 'Last 6 months' ? 6 : 12;
    const firstMonth = this.reportRange === 'This year' ? 0 : now.getMonth() - monthCount + 1;
    const months = Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(now.getFullYear(), firstMonth + index, 1);
      const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const entries = this.reportEntries.filter((entry) => entry.date.startsWith(prefix));
      return {
        month: date.toLocaleString('en-US', { month: 'short' }),
        fuel: entries.filter((entry) => entry.kind === 'fuel').reduce((sum, entry) => sum + entry.amount, 0),
        expense: entries.filter((entry) => entry.kind === 'expense' || entry.kind === 'service').reduce((sum, entry) => sum + entry.amount, 0),
        income: entries.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount, 0),
      };
    });
    const max = Math.max(1, ...months.flatMap((month) => [month.fuel, month.expense, month.income]));
    return months.map((month) => ({
      ...month,
      fuelHeight: month.fuel ? Math.max(4, month.fuel / max * 100) : 0,
      expenseHeight: month.expense ? Math.max(4, month.expense / max * 100) : 0,
      incomeHeight: month.income ? Math.max(4, month.income / max * 100) : 0,
    }));
  }

  trackById(_index: number, item: { id: string }): string { return item.id; }

  openEntry(kind: EntryKind = 'fuel'): void {
    this.editingEntryId = null;
    this.entryKind = kind;
    this.title = '';
    this.amount = '';
    this.odometer = String(this.selectedVehicle?.odometer ?? '');
    this.date = new Date().toISOString().slice(0, 10);
    this.note = '';
    this.formError = '';
    this.modalOpen = true;
  }

  editEntry(entry: LedgerEntry): void {
    this.editingEntryId = entry.id;
    this.selectedVehicleId = entry.vehicleId;
    this.entryKind = entry.kind;
    this.title = entry.title;
    this.amount = String(entry.amount);
    this.odometer = String(entry.odometer);
    this.date = entry.date;
    this.note = entry.note ?? '';
    this.formError = '';
    this.modalOpen = true;
  }

  async saveEntry(): Promise<void> {
    const parsedAmount = Number(this.amount);
    const parsedOdometer = Number(this.odometer);
    if (!this.selectedVehicleId || !this.title.trim() || parsedAmount <= 0 || parsedOdometer < 0 || !this.date) {
      this.formError = 'Add a description, a positive amount, an odometer reading, and a date.';
      return;
    }
    try {
      const entry = { vehicleId: this.selectedVehicleId, kind: this.entryKind, title: this.title.trim(), amount: parsedAmount, odometer: parsedOdometer, date: this.date, note: this.note.trim() };
      if (this.editingEntryId) await this.ledger.updateEntry({ ...entry, id: this.editingEntryId });
      else await this.ledger.addEntry(entry);
      this.modalOpen = false;
      this.formError = '';
    } catch {
      this.formError = 'The entry could not be saved. Check your connection and try again.';
    }
  }

  async saveVehicle(): Promise<void> {
    const name = this.vehicleName.trim() || `${this.vehicleMake.trim()} ${this.vehicleModel.trim()}`.trim();
    const odometer = Number(this.vehicleOdometer);
    if (!name || !this.vehicleMake.trim() || !this.vehicleModel.trim() || odometer < 0) return;
    try {
      const vehicle = await this.ledger.addVehicle({ name, make: this.vehicleMake.trim(), model: this.vehicleModel.trim(), year: Number(this.vehicleYear), odometer, plate: '' });
      this.selectedVehicleId = vehicle.id;
      this.vehicleModalOpen = false;
      this.vehicleName = this.vehicleMake = this.vehicleModel = this.vehicleOdometer = '';
    } catch {
      this.loadError = 'The vehicle could not be saved. Check your connection and try again.';
    }
  }

  async saveReminder(): Promise<void> {
    if (!this.reminderTitle.trim() || (!this.reminderDate && !this.reminderOdometer)) return;
    try {
      await this.ledger.addReminder({ vehicleId: this.selectedVehicleId, title: this.reminderTitle.trim(), dueDate: this.reminderDate || undefined, dueOdometer: this.reminderOdometer ? Number(this.reminderOdometer) : undefined });
      this.reminderModalOpen = false;
      this.reminderTitle = this.reminderDate = this.reminderOdometer = '';
    } catch {
      this.loadError = 'The reminder could not be saved. Check your connection and try again.';
    }
  }

  currency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  reminderDue(reminder: { dueDate?: string; dueOdometer?: number }): string {
    if (reminder.dueDate) {
      const days = Math.ceil((new Date(`${reminder.dueDate}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
      if (days < 0) return `${Math.abs(days)} days overdue`;
      if (days === 0) return 'Due today';
      if (days === 1) return 'Due tomorrow';
      return `In ${days} days`;
    }
    const distance = (reminder.dueOdometer ?? 0) - (this.selectedVehicle?.odometer ?? 0);
    return distance < 0 ? `${Math.abs(distance).toLocaleString()} mi overdue` : `In ${distance.toLocaleString()} mi`;
  }

  kindIcon(kind: EntryKind): string {
    return { fuel: 'flame-outline', expense: 'card-outline', income: 'trending-up-outline', service: 'construct-outline' }[kind];
  }

  async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      this.auth.clearSession();
      await this.router.navigateByUrl('/auth');
    }
  }

}
