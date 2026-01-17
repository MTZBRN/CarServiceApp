export interface Customer {
    id: number;
    name: string;
    address?: string;
    phoneNumber?: string;
    email?: string;
}

export interface Vehicle {
    id: number;
    licensePlate: string;
    make: string;
    model: string;
    year: number;
    motExpiry?: string | null; // A backend stringként küldi a dátumot
    customerId: number;
    customer?: Customer;
}

export interface Appointment {
    id: number;
    vehicleId: number;
    startTime: string;
    endTime: string;
    note?: string;
    description?: string; // Néha így jön a backendről
    vehicle?: Vehicle;
    serviceJob?: ServiceJob; 
}

// A Naptárnak ilyen formátum kell:
export interface CalendarEvent {
    id?: number;
    title: string;
    tooltip?: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    type: 'service' | 'mot'; // Csak ez a két típus lehet
    originalData?: Appointment | Vehicle; // Eltároljuk az eredeti adatot is
    desc?: string;
}

export interface JobPart {
    id?: number;
    itemName: string;
    partNumber: string;
    partName: string;
    quantity: number;
    unitPrice: number;
}

export interface ServiceJob {
    id?: number;
    appointmentId: number;
    description: string;
    laborCost: number;
    isCompleted: boolean;
    jobParts: JobPart[];
    appointment?: Appointment;
}

export interface Part {
    id: number;
    partNumber: string; // Cikkszám
    name: string;
    netPrice: number;
    grossPrice: number;
    stockQuantity: number;
}
