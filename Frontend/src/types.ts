export interface Customer {
  id: number;
  name: string;
  address?: string;
  phoneNumber?: string; // Backendtől függ, lehet 'phone' is, ellenőrizd!
  email?: string;
}

export interface Vehicle {
  id: number;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  motExpiry?: string | null;
  customerId: number;
  customer?: Customer;
}

export interface Appointment {
  id: number;
  vehicleId: number;
  startTime: string;
  endTime: string;
  note?: string;
  description?: string;
  vehicle?: Vehicle;
  serviceJob?: ServiceJob;
}

// Naptárhoz segédtípus
export interface CalendarEvent {
  id?: number | string; // Engedjük meg a stringet is (pl "job-1")
  title: string;
  tooltip?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  type: "service" | "mot" | "job" | "appointment"; // Bővítettük
  originalData?: any;
  desc?: string;
}

export interface JobPart {
  id?: number;
  itemName: string; // VAGY partName? A Backenden JobPart-ban mi van?
  quantity: number;
  unitPrice: number;
  partNumber?: string;
  partName?: string;
}

// --- ITT A LÉNYEG! ---
export interface ServiceJob {
  id?: number;
  appointmentId?: number;
  appointment?: Appointment;
  vehicleId: number;
  vehicle?: Vehicle;
  date: string;
  description: string;
  laborCost: number;
  isCompleted: boolean;
  jobParts: JobPart[];
}

export interface Part {
  id: number;
  partNumber: string;
  name: string;
  netPrice: number;
  grossPrice: number;
  stockQuantity: number;
}
