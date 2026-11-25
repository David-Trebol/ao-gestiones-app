export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Customer {
  nombre_empresa: string;
  contacto: string;
  departamento: string;
  numero_referencia_pedido: string;
  direccion_1: string;
  direccion_2: string;
  codigo_postal: string;
  provincia: string;
  pais: string;
  telefono_1: string;
  telefono_2: string;
  email: string;
  nif: string;
  oferta_proforma: string;
  condiciones_entrega: string;
  condiciones_pago: string;
  numero_factura: string;
  numero_recibo: string;
}

/** Estado de cada producto dentro del pedido (opcional; sin valor = sin empezar) */
export type ItemStatus = 'none' | 'pending' | 'shipped' | 'delivered';

/** Apunte del registro con el fabricante de un producto: qué se hizo y cuándo */
export type SupplierEventType = 'ordered' | 'received' | 'payment_pending' | 'paid' | 'other';
export interface SupplierEvent {
  id: string;
  type: SupplierEventType;
  /** AAAA-MM-DD */
  date: string;
  note?: string;
  created_at?: string;
}

/** Fabricante real al que se le compra un producto (tabla «suppliers») */
export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

/** Datos opcionales del fabricante de un producto (dentro de orders.items) */
export interface ItemSupplierFields {
  supplier_id?: string;
  /** nombre copiado para mostrarlo aunque se borre el fabricante */
  supplier_name?: string;
  supplier_log?: SupplierEvent[];
}

export interface OrderItem extends ItemSupplierFields {
  product_name: string;
  quantity: number;
  costo_unitario: number;
  tpv_unitario: number;
  total_sin_iva: number;
  descuento_porcentaje: number;
  pvp_neto_sin_iva: number;
  valor_sin_iva: number;
  beneficio_bruto: number;
  valor_con_iva: number;
  vat_percentage: number;
  item_status?: ItemStatus;
}

export interface ShippingItem {
  description: string;
  quantity: number;
  costo_unitario: number;
  total_sin_iva: number;
  vat_percentage: number;
  valor_sin_iva: number;
  valor_con_iva: number;
}

export interface Order {
  id: string;
  reference_number: string;
  custom_reference: string;
  manufacturer_id: string;
  manufacturer_name: string;
  manufacturer_code: string;
  year: number;
  status: OrderStatus;
  customer: Customer;
  items: OrderItem[];
  shipping_items: ShippingItem[];
  shipping_cost: number;
  total_ex_vat: number;
  total_vat: number;
  total_with_vat: number;
  /** Seguimiento (opcional): fecha prevista AAAA-MM-DD, responsable y siguiente acción */
  expected_date: string | null;
  owner: string;
  next_action: string;
  created_at: string;
  updated_at: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  code: string;
  active_years: number[];
  created_at: string;
}

export interface YearData {
  year: number;
  ordersCount: number;
  manufacturersCount: number;
  totalAmount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface OrderFormData {
  customer: Customer;
  manufacturer_id: string;
  year: number;
  status: OrderStatus;
  shipping_cost: number;
  custom_reference: string;
  items: OrderFormItem[];
  shipping_items: ShippingFormItem[];
  expected_date: string | null;
  owner: string;
  next_action: string;
}

export interface OrderFormItem extends ItemSupplierFields {
  item_status?: ItemStatus;
  product_name: string;
  quantity: number;
  costo_unitario: number;
  tpv_unitario: number;
  total_sin_iva: number;
  descuento_porcentaje: number;
  vat_percentage: number;
}

export interface ShippingFormItem {
  description: string;
  quantity: number;
  costo_unitario: number;
  total_sin_iva: number;
  vat_percentage: number;
}

export type NavigationView = 'years' | 'manufacturers' | 'orders' | 'detail';
