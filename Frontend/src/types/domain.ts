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
  version?: string;
  id: number;
  vehicleId: number;
  startTime: string;
  endTime: string;
  note?: string;
  vehicle?: Vehicle;
  serviceJob?: ServiceJob;
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
  version?: string;
  id: number;
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
  version?: string;
  id: number;
  partNumber: string;
  name: string;
  netPrice: number;
  grossPrice: number;
  stockQuantity: number;
}

export interface SessionUser { userName: string; role: string; profilePicturePath?: string | null; }
export interface User { id: number; name: string; email: string; role: string; profilePicturePath?: string | null; }
export interface WorkshopSettings { version?: string; id: number; companyName: string; address: string; taxNumber: string; phone: string; email: string; hourlyRate: number; vatRate: number; }
