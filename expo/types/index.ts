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

export interface OrderItem {
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
}

export interface OrderFormItem {
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
