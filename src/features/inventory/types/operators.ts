/** People who open a van on the phone. Separate from crews.vehicle_id. */

export interface VehicleOperator {
  id: string;
  vehicleId: string;
  userId: string;
  isHome: boolean;
}

export interface VanPerson {
  id: string;
  name: string;
  role: string;
}

export interface VanAssignment {
  vehicleId: string;
  userId: string;
  isHome: boolean;
}
