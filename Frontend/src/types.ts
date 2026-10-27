export interface Customer {
  id: number;
  name: string;
  phoneNumber: string;
  email: string | null;
  address: string | null;
}

export interface Vehicle {
  id: number;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
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
  type?: "service" | "mot";
}

// Naptárhoz segédtípus
export interface CalendarEvent {
  id?: number | string; // Engedjük meg a stringet is (pl "job-1")
  title: string;
  tooltip?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  type: "service" | "mot" | "job" | "appointment";
  originalData?: any;
  desc?: string;
}

export interface JobPart {
  id?: number;
  quantity: number;
  unitPrice: number;
  partNumber?: string;
  partName: string;
}

// --- ITT A LÉNYEG! ---
export interface ServiceJob {
  id?: number;
  appointmentId?: number | null;
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
