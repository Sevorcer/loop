/** Office van screens. Cost is never part of these shapes. */

export interface VanCopySource {
  vehicleId: string;
  name: string;
  pars: { itemId: string; minQty: number | null; maxQty: number | null }[];
}
