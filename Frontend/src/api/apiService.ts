// Compatibility facade for the existing feature pages. Transport and payloads live in resource modules.
import { customersApi } from './customers';
import { vehiclesApi } from './vehicles';
import { appointmentsApi } from './appointments';
import { worksheetsApi } from './worksheets';
import { inventoryApi } from './inventory';
import { seedDatabase } from './development';
export const apiService = {
 getCustomers: customersApi.list, createCustomer: customersApi.create,
 getVehicles: vehiclesApi.list, createVehicle: vehiclesApi.create, deleteVehicle: vehiclesApi.remove,
 getAppointments: appointmentsApi.list, createAppointment: appointmentsApi.create, deleteAppointment: appointmentsApi.remove,
 getServiceJob: worksheetsApi.get, getServiceJobs: worksheetsApi.list,
 createServiceJob: worksheetsApi.create, updateServiceJob: worksheetsApi.update, deleteServiceJob: worksheetsApi.remove,
 getServiceJobByAppointment: worksheetsApi.byAppointment, getServiceHistory: worksheetsApi.byVehicle,
 getParts: inventoryApi.list, createPart: inventoryApi.create, updatePart: inventoryApi.update, deletePart: inventoryApi.remove,
 seedDatabase,
};
