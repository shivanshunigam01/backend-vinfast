import { adminDeleteJson, adminGetData, adminPostJson, adminPutJson, publicGet } from "@/lib/api";

/** Public catalog entry: active model with its active variant (trim) names. */
export type CatalogModel = { name: string; variants: string[] };

export type AdminVehicleModelVariant = { name: string; active: boolean; displayOrder: number };

export type AdminVehicleModel = {
  _id: string;
  name: string;
  active: boolean;
  displayOrder: number;
  variants: AdminVehicleModelVariant[];
  createdAt?: string;
  updatedAt?: string;
};

export type VehicleModelPayload = {
  name: string;
  active?: boolean;
  displayOrder?: number;
  variants?: { name: string; active?: boolean; displayOrder?: number }[];
};

export async function fetchPublicVehicleCatalog(): Promise<CatalogModel[] | null> {
  return publicGet<CatalogModel[]>("/public/vehicle-models");
}

export async function fetchAdminVehicleModels(): Promise<AdminVehicleModel[]> {
  return adminGetData<AdminVehicleModel[]>("/admin/vehicle-models");
}

export async function createVehicleModel(payload: VehicleModelPayload): Promise<AdminVehicleModel> {
  return adminPostJson<AdminVehicleModel>("/admin/vehicle-models", payload);
}

export async function updateVehicleModel(
  id: string,
  payload: Partial<VehicleModelPayload>,
): Promise<AdminVehicleModel> {
  return adminPutJson<AdminVehicleModel>(`/admin/vehicle-models/${id}`, payload);
}

export async function deleteVehicleModel(id: string): Promise<void> {
  await adminDeleteJson(`/admin/vehicle-models/${id}`);
}
