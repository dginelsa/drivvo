import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service';
import { HomePage } from './home.page';
import { LedgerService } from './ledger.service';

describe('HomePage', () => {
  let component: HomePage;
  let ledgerStub: {
    vehicles: Array<{ id: string; name: string; make: string; model: string; year: number; odometer: number; plate: string }>;
    entries: Array<{ id: string; vehicleId: string; kind: 'income' | 'fuel'; title: string; amount: number; odometer: number; date: string }>;
    reminders: Array<{ id: string; vehicleId: string; title: string; dueOdometer: number; done: boolean }>;
    initialize: ReturnType<typeof vi.fn>;
    getKindLabel: (kind: string) => string;
    addEntry: ReturnType<typeof vi.fn>;
    updateEntry: ReturnType<typeof vi.fn>;
    addVehicle: ReturnType<typeof vi.fn>;
    addReminder: ReturnType<typeof vi.fn>;
    toggleReminder: ReturnType<typeof vi.fn>;
  };
  let cdrStub: { detectChanges: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const today = new Date().toISOString().slice(0, 10);
    ledgerStub = {
      vehicles: [{ id: 'car-1', name: 'My car', make: 'Toyota', model: 'Corolla', year: 2022, odometer: 52051, plate: '' }],
      entries: [
        { id: 'income-1', vehicleId: 'car-1', kind: 'income', title: 'Trip', amount: 80, odometer: 52000, date: today },
        { id: 'fuel-1', vehicleId: 'car-1', kind: 'fuel', title: 'Fuel', amount: 30, odometer: 52010, date: today },
      ],
      reminders: [{ id: 'reminder-1', vehicleId: 'car-1', title: 'Oil change', dueOdometer: 52100, done: false }],
      initialize: vi.fn().mockResolvedValue(undefined),
      getKindLabel: (kind: string) => kind,
      addEntry: vi.fn().mockResolvedValue(undefined),
      updateEntry: vi.fn().mockResolvedValue(undefined),
      addVehicle: vi.fn().mockResolvedValue(undefined),
      addReminder: vi.fn().mockResolvedValue(undefined),
      toggleReminder: vi.fn().mockResolvedValue(undefined),
    };
    const authStub = { logout: vi.fn().mockResolvedValue(undefined), clearSession: vi.fn() };
    const routerStub = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    cdrStub = { detectChanges: vi.fn() };
    component = Object.create(HomePage.prototype) as HomePage;
    Object.assign(component, {
      ledger: ledgerStub as unknown as LedgerService,
      auth: authStub as unknown as AuthService,
      router: routerStub as unknown as Router,
      cdr: cdrStub,
      selectedVehicleId: 'car-1',
      activeTab: 'history',
      isLoading: true,
      note: '',
      editingEntryId: null,
      modalOpen: false,
      formError: '',
    });
  });

  it('loads a vehicle and calculates the current month totals', async () => {
    await component.ngOnInit();
    expect(component.selectedVehicle?.name).toBe('My car');
    expect(component.monthlyBalance).toBe(50);
    expect(component.monthlyFuelTotal).toBe(30);
    expect(component.isLoading).toBe(false);
    expect(cdrStub.detectChanges).toHaveBeenCalledTimes(1);
  });

  it('stops loading and refreshes the view when initialization fails', async () => {
    ledgerStub.initialize.mockRejectedValueOnce(new Error('boom'));
    await component.ngOnInit();
    expect(component.loadError).toContain('could not be loaded');
    expect(component.isLoading).toBe(false);
    expect(cdrStub.detectChanges).toHaveBeenCalledTimes(1);
  });

  it('creates an entry for the selected vehicle', async () => {
    await component.ngOnInit();
    component.title = 'Parking';
    component.amount = '12';
    component.odometer = '52060';
    component.date = new Date().toISOString().slice(0, 10);
    await component.saveEntry();
    expect(ledgerStub.addEntry).toHaveBeenCalledWith(expect.objectContaining({ title: 'Parking', vehicleId: 'car-1', amount: 12 }));
  });

  it('opens an existing entry for editing', () => {
    component.editEntry(component.visibleEntries[0]);
    expect(component.editingEntryId).toBe('income-1');
    expect(component.title).toBe('Trip');
  });

  it('filters report totals when the period changes', () => {
    const previousYear = new Date().getFullYear() - 1;
    ledgerStub.entries.push({ id: 'old-income', vehicleId: 'car-1', kind: 'income', title: 'Old trip', amount: 100, odometer: 51000, date: `${previousYear}-01-15` });
    component.reportRange = 'This year';
    expect(component.totalIncome).toBe(80);
    component.reportRange = 'All time';
    expect(component.totalIncome).toBe(180);
    expect(component.bars).toHaveLength(12);
    component.reportRange = 'Last 6 months';
    expect(component.bars).toHaveLength(6);
  });
});
