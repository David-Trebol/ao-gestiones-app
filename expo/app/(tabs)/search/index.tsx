import { Redirect } from 'expo-router';

// La búsqueda está en la pantalla de Pedidos (busca por referencia, cliente, NIF, producto, factura…)
export default function SearchRedirect() {
  return <Redirect href="/" />;
}
