import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Order, Manufacturer, OrderFormData } from '@/types';
import { calculateItemTotals, calculateShippingTotals, generateReferenceNumber, generateId } from '@/utils/calculations';
import { supabase, describeError } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Capa de datos conectada a Supabase.
 * - Lee pedidos, fabricantes y años de la base de datos (solo con sesión iniciada).
 * - Cada operación escribe en Supabase y, si va bien, actualiza la caché local.
 * - Si falla, lanza un Error con un mensaje en español que la pantalla muestra al usuario.
 * - Escucha cambios en tiempo real para sincronizar varios dispositivos.
 */

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function normalizeOrder(row: any): Order {
  return {
    ...row,
    year: Number(row.year),
    shipping_cost: Number(row.shipping_cost) || 0,
    total_ex_vat: Number(row.total_ex_vat) || 0,
    total_vat: Number(row.total_vat) || 0,
    total_with_vat: Number(row.total_with_vat) || 0,
    customer: row.customer ?? {},
    items: row.items ?? [],
    shipping_items: row.shipping_items ?? [],
    custom_reference: row.custom_reference ?? '',
  } as Order;
}

function normalizeManufacturer(row: any): Manufacturer {
  return { ...row, active_years: (row.active_years ?? []).map(Number) } as Manufacturer;
}

function fail(error: unknown): never {
  throw new Error(describeError(error));
}

async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: true });
  if (error) fail(error);
  return (data ?? []).map(normalizeOrder);
}

async function fetchManufacturers(): Promise<Manufacturer[]> {
  const { data, error } = await supabase.from('manufacturers').select('*').order('name', { ascending: true });
  if (error) fail(error);
  return (data ?? []).map(normalizeManufacturer);
}

async function fetchYears(): Promise<number[]> {
  const { data, error } = await supabase.from('years').select('year').order('year', { ascending: false });
  if (error) fail(error);
  return (data ?? []).map((r: { year: number }) => Number(r.year));
}

function computeTotals(formData: OrderFormData) {
  const items = formData.items.map(item => calculateItemTotals(item));
  const shipping_items = formData.shipping_items.map(s => calculateShippingTotals(s));
  const totalExVat = items.reduce((sum, i) => sum + i.valor_sin_iva, 0);
  const totalVat = items.reduce((sum, i) => sum + (i.valor_con_iva - i.valor_sin_iva), 0);
  const shippingTotal = shipping_items.reduce((sum, s) => sum + s.valor_con_iva, 0);
  return {
    items,
    shipping_items,
    shipping_cost: round2(formData.shipping_cost),
    total_ex_vat: round2(totalExVat),
    total_vat: round2(totalVat),
    total_with_vat: round2(totalExVat + totalVat + shippingTotal + (formData.shipping_cost || 0)),
  };
}

/** Lee las referencias existentes de un fabricante+año directamente de la base de datos */
async function fetchReferences(code: string, year: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('reference_number')
    .like('reference_number', `${code}-${year}-%`);
  if (error) fail(error);
  return (data ?? []).map((r: { reference_number: string }) => r.reference_number);
}

/** Inserta un pedido generando la siguiente referencia libre; reintenta si otro dispositivo la ocupó a la vez */
async function insertOrderWithReference(base: Omit<Order, 'reference_number'>, code: string, year: number): Promise<Order> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const refs = await fetchReferences(code, year);
    const reference_number = generateReferenceNumber(code, year, refs);
    const { data, error } = await supabase
      .from('orders')
      .insert({ ...base, reference_number })
      .select()
      .single();
    if (!error) return normalizeOrder(data);
    if ((error as { code?: string }).code !== '23505') fail(error);
  }
  throw new Error('No se pudo generar una referencia única. Inténtalo de nuevo.');
}

async function ensureYear(year: number) {
  const { error } = await supabase.from('years').upsert({ year }, { onConflict: 'year', ignoreDuplicates: true });
  if (error) fail(error);
}

export const [DataProvider, useData] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: fetchOrders, enabled: isAuthenticated, staleTime: 30_000 });
  const manufacturersQuery = useQuery({ queryKey: ['manufacturers'], queryFn: fetchManufacturers, enabled: isAuthenticated, staleTime: 30_000 });
  const yearsQuery = useQuery({ queryKey: ['years'], queryFn: fetchYears, enabled: isAuthenticated, staleTime: 30_000 });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const manufacturers = useMemo(() => manufacturersQuery.data ?? [], [manufacturersQuery.data]);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);

  // Limpia la caché al cerrar sesión para no mostrar datos de otro usuario
  useEffect(() => {
    if (!isAuthenticated) {
      queryClient.removeQueries({ queryKey: ['orders'] });
      queryClient.removeQueries({ queryKey: ['manufacturers'] });
      queryClient.removeQueries({ queryKey: ['years'] });
    }
  }, [isAuthenticated, queryClient]);

  // Tiempo real: si otro dispositivo cambia algo, se recarga la tabla afectada
  useEffect(() => {
    if (!isAuthenticated) return;
    const channel = supabase
      .channel('ao-data-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manufacturers' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'years' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['years'] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, queryClient]);

  const setOrders = useCallback((fn: (prev: Order[]) => Order[]) => {
    queryClient.setQueryData<Order[]>(['orders'], prev => fn(prev ?? []));
  }, [queryClient]);
  const setManufacturers = useCallback((fn: (prev: Manufacturer[]) => Manufacturer[]) => {
    queryClient.setQueryData<Manufacturer[]>(['manufacturers'], prev => fn(prev ?? []));
  }, [queryClient]);
  const setYears = useCallback((fn: (prev: number[]) => number[]) => {
    queryClient.setQueryData<number[]>(['years'], prev => fn(prev ?? []));
  }, [queryClient]);

  const addYearToCache = useCallback((year: number) => {
    setYears(prev => (prev.includes(year) ? prev : [...prev, year].sort((a, b) => b - a)));
  }, [setYears]);

  // ---------- Pedidos ----------

  const addOrder = useCallback(async (formData: OrderFormData): Promise<Order> => {
    const manufacturer = manufacturers.find(m => m.id === formData.manufacturer_id);
    if (!manufacturer) throw new Error('Selecciona un fabricante válido');
    await ensureYear(formData.year);
    const now = new Date().toISOString();
    const created = await insertOrderWithReference({
      id: generateId(),
      custom_reference: formData.custom_reference.trim(),
      manufacturer_id: manufacturer.id,
      manufacturer_name: manufacturer.name,
      manufacturer_code: manufacturer.code,
      year: formData.year,
      status: formData.status,
      customer: formData.customer,
      ...computeTotals(formData),
      created_at: now,
      updated_at: now,
    }, manufacturer.code, formData.year);
    setOrders(prev => [...prev, created]);
    addYearToCache(formData.year);
    return created;
  }, [manufacturers, setOrders, addYearToCache]);

  const updateOrder = useCallback(async (orderId: string, formData: OrderFormData): Promise<Order> => {
    const manufacturer = manufacturers.find(m => m.id === formData.manufacturer_id);
    if (!manufacturer) throw new Error('Selecciona un fabricante válido');
    const existing = orders.find(o => o.id === orderId);
    await ensureYear(formData.year);

    const changes: Record<string, unknown> = {
      custom_reference: formData.custom_reference.trim(),
      manufacturer_id: manufacturer.id,
      manufacturer_name: manufacturer.name,
      manufacturer_code: manufacturer.code,
      year: formData.year,
      status: formData.status,
      customer: formData.customer,
      ...computeTotals(formData),
    };

    // Si cambia el fabricante o el año, la referencia pasa a la serie correcta
    const seriesChanged = !existing || existing.manufacturer_id !== manufacturer.id || existing.year !== formData.year;
    if (seriesChanged) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const refs = await fetchReferences(manufacturer.code, formData.year);
        const { data, error } = await supabase
          .from('orders')
          .update({ ...changes, reference_number: generateReferenceNumber(manufacturer.code, formData.year, refs) })
          .eq('id', orderId)
          .select()
          .single();
        if (!error) {
          const updated = normalizeOrder(data);
          setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
          addYearToCache(formData.year);
          return updated;
        }
        if ((error as { code?: string }).code !== '23505') fail(error);
      }
      throw new Error('No se pudo generar una referencia única. Inténtalo de nuevo.');
    }

    const { data, error } = await supabase.from('orders').update(changes).eq('id', orderId).select().single();
    if (error) fail(error);
    const updated = normalizeOrder(data);
    setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
    return updated;
  }, [manufacturers, orders, setOrders, addYearToCache]);

  const updateOrderField = useCallback(async (orderId: string, field: 'custom_reference' | 'status', value: string) => {
    const { data, error } = await supabase.from('orders').update({ [field]: value }).eq('id', orderId).select().single();
    if (error) fail(error);
    const updated = normalizeOrder(data);
    setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
  }, [setOrders]);

  const deleteOrder = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) fail(error);
    setOrders(prev => prev.filter(o => o.id !== orderId));
  }, [setOrders]);

  const duplicateOrder = useCallback(async (orderId: string, targetYear?: number): Promise<Order> => {
    const original = orders.find(o => o.id === orderId);
    if (!original) throw new Error('No se encontró el pedido original');
    const year = targetYear ?? original.year;
    const manufacturer = manufacturers.find(m => m.id === original.manufacturer_id);
    const code = manufacturer?.code ?? original.manufacturer_code;
    await ensureYear(year);
    const now = new Date().toISOString();
    const { reference_number: _ref, ...rest } = original;
    const created = await insertOrderWithReference({
      ...rest,
      id: generateId(),
      custom_reference: original.custom_reference ? `${original.custom_reference} (copia)` : '',
      year,
      // Una copia empieza como pedido nuevo: pendiente y sin factura/recibo
      status: 'pending',
      customer: { ...original.customer, numero_factura: '', numero_recibo: '' },
      created_at: now,
      updated_at: now,
    }, code, year);
    setOrders(prev => [...prev, created]);
    addYearToCache(year);
    return created;
  }, [orders, manufacturers, setOrders, addYearToCache]);

  /** Duplica varios pedidos uno a uno (cada copia con su propia referencia) */
  const duplicateOrders = useCallback(async (orderIds: string[], targetYear?: number): Promise<number> => {
    let count = 0;
    for (const id of orderIds) {
      await duplicateOrder(id, targetYear);
      count++;
    }
    return count;
  }, [duplicateOrder]);

  // ---------- Fabricantes ----------

  const addManufacturer = useCallback(async (name: string, code: string, activeYears: number[] = []): Promise<Manufacturer> => {
    const cleanCode = code.trim().toUpperCase();
    if (manufacturers.some(m => m.code.toUpperCase() === cleanCode)) {
      throw new Error(`Ya existe un fabricante con el código "${cleanCode}"`);
    }
    const { data, error } = await supabase
      .from('manufacturers')
      .insert({ id: generateId(), name: name.trim(), code: cleanCode, active_years: activeYears })
      .select()
      .single();
    if (error) fail(error);
    const created = normalizeManufacturer(data);
    setManufacturers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'es')));
    return created;
  }, [manufacturers, setManufacturers]);

  const updateManufacturer = useCallback(async (id: string, updates: Partial<Pick<Manufacturer, 'name' | 'code' | 'active_years'>>) => {
    const clean: Record<string, unknown> = { ...updates };
    if (typeof updates.code === 'string') {
      const code = updates.code.trim().toUpperCase();
      if (manufacturers.some(m => m.id !== id && m.code.toUpperCase() === code)) {
        throw new Error(`Ya existe un fabricante con el código "${code}"`);
      }
      clean.code = code;
    }
    if (typeof updates.name === 'string') clean.name = updates.name.trim();
    const { data, error } = await supabase.from('manufacturers').update(clean).eq('id', id).select().single();
    if (error) fail(error);
    const updated = normalizeManufacturer(data);
    setManufacturers(prev => prev.map(m => (m.id === id ? updated : m)));

    // Mantener nombre/código coherentes en sus pedidos
    if (clean.name !== undefined || clean.code !== undefined) {
      const { error: e2 } = await supabase
        .from('orders')
        .update({ manufacturer_name: updated.name, manufacturer_code: updated.code })
        .eq('manufacturer_id', id);
      if (e2) fail(e2);
      setOrders(prev => prev.map(o => (o.manufacturer_id === id ? { ...o, manufacturer_name: updated.name, manufacturer_code: updated.code } : o)));
    }
    if (updates.active_years) {
      for (const y of updates.active_years) {
        if (!years.includes(y)) {
          await ensureYear(y);
          addYearToCache(y);
        }
      }
    }
    return updated;
  }, [manufacturers, years, setManufacturers, setOrders, addYearToCache]);

  /** Devuelve false si el fabricante tiene pedidos (no se borra) */
  const deleteManufacturer = useCallback(async (id: string): Promise<boolean> => {
    const { count, error: countError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('manufacturer_id', id);
    if (countError) fail(countError);
    if ((count ?? 0) > 0) return false;
    const { error } = await supabase.from('manufacturers').delete().eq('id', id);
    if (error) fail(error);
    setManufacturers(prev => prev.filter(m => m.id !== id));
    return true;
  }, [setManufacturers]);

  /** Crea una copia con un código libre (ACM2, ACM3...) */
  const duplicateManufacturer = useCallback(async (manufacturer: Manufacturer): Promise<Manufacturer> => {
    const base = manufacturer.code.toUpperCase();
    let n = 2;
    while (manufacturers.some(m => m.code.toUpperCase() === `${base}${n}`)) n++;
    return addManufacturer(`${manufacturer.name} (copia)`, `${base}${n}`, manufacturer.active_years ?? []);
  }, [manufacturers, addManufacturer]);

  // ---------- Años ----------

  /** Devuelve false si el año ya existía */
  const addYear = useCallback(async (year: number): Promise<boolean> => {
    if (years.includes(year)) return false;
    await ensureYear(year);
    addYearToCache(year);
    return true;
  }, [years, addYearToCache]);

  const deleteYear = useCallback(async (year: number) => {
    const { error: e1 } = await supabase.from('orders').delete().eq('year', year);
    if (e1) fail(e1);
    const { error: e2 } = await supabase.from('years').delete().eq('year', year);
    if (e2) fail(e2);
    setOrders(prev => prev.filter(o => o.year !== year));
    setYears(prev => prev.filter(y => y !== year));
  }, [setOrders, setYears]);

  /** Borra TODOS los pedidos, fabricantes y años (solo desde Ajustes, con confirmación) */
  const deleteAllData = useCallback(async () => {
    const { error: e1 } = await supabase.from('orders').delete().neq('id', '');
    if (e1) fail(e1);
    const { error: e2 } = await supabase.from('manufacturers').delete().neq('id', '');
    if (e2) fail(e2);
    const { error: e3 } = await supabase.from('years').delete().gte('year', 0);
    if (e3) fail(e3);
    queryClient.setQueryData(['orders'], []);
    queryClient.setQueryData(['manufacturers'], []);
    queryClient.setQueryData(['years'], []);
  }, [queryClient]);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] }),
      queryClient.invalidateQueries({ queryKey: ['years'] }),
    ]);
  }, [queryClient]);

  // ---------- Consultas derivadas ----------

  const getOrdersByYear = useCallback((year: number) => orders.filter(o => o.year === year), [orders]);

  const getOrdersByManufacturerAndYear = useCallback(
    (manufacturerId: string, year: number) => orders.filter(o => o.manufacturer_id === manufacturerId && o.year === year),
    [orders],
  );

  const getManufacturersForYear = useCallback((year: number) => {
    const ids = new Set<string>([
      ...manufacturers.filter(m => m.active_years?.includes(year)).map(m => m.id),
      ...orders.filter(o => o.year === year).map(o => o.manufacturer_id),
    ]);
    return manufacturers.filter(m => ids.has(m.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [manufacturers, orders]);

  const isLoading = isAuthenticated && (ordersQuery.isLoading || manufacturersQuery.isLoading || yearsQuery.isLoading);
  const loadError = ordersQuery.error || manufacturersQuery.error || yearsQuery.error;

  return {
    orders,
    manufacturers,
    years,
    isLoading,
    loadError: loadError ? (loadError as Error).message : null,
    refresh,
    addOrder,
    updateOrder,
    updateOrderField,
    deleteOrder,
    duplicateOrder,
    duplicateOrders,
    addManufacturer,
    updateManufacturer,
    deleteManufacturer,
    duplicateManufacturer,
    addYear,
    deleteYear,
    deleteAllData,
    getOrdersByYear,
    getOrdersByManufacturerAndYear,
    getManufacturersForYear,
  };
});

export function useSearchOrders(searchTerm: string) {
  const { orders } = useData();
  return useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return orders.filter(order => {
      if (order.reference_number?.toLowerCase().includes(term)) return true;
      if (order.custom_reference?.toLowerCase().includes(term)) return true;
      const c = order.customer ?? ({} as Order['customer']);
      if (c.nombre_empresa?.toLowerCase().includes(term)) return true;
      if (c.contacto?.toLowerCase().includes(term)) return true;
      if (c.email?.toLowerCase().includes(term)) return true;
      if (c.nif?.toLowerCase().includes(term)) return true;
      if (c.telefono_1?.toLowerCase().includes(term)) return true;
      if (c.telefono_2?.toLowerCase().includes(term)) return true;
      if (c.provincia?.toLowerCase().includes(term)) return true;
      if (c.direccion_1?.toLowerCase().includes(term)) return true;
      if (c.numero_factura?.toLowerCase().includes(term)) return true;
      if (c.numero_recibo?.toLowerCase().includes(term)) return true;
      if (c.oferta_proforma?.toLowerCase().includes(term)) return true;
      if (c.numero_referencia_pedido?.toLowerCase().includes(term)) return true;
      if (order.manufacturer_name?.toLowerCase().includes(term)) return true;
      if (order.manufacturer_code?.toLowerCase().includes(term)) return true;
      if (order.items?.some(item => item.product_name?.toLowerCase().includes(term))) return true;
      if (order.shipping_items?.some(s => s.description?.toLowerCase().includes(term))) return true;
      if (order.year?.toString().includes(term)) return true;
      if (order.status?.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [orders, searchTerm]);
}
