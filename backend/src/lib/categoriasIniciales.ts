// Set inicial de categorías para hogares argentinos.
// Se precargan al crear un hogar para no arrancar de cero.

type CategoriaInicial = {
  nombre: string;
  tipo: "gasto" | "ingreso";
  esFijo: boolean;
};

export const CATEGORIAS_INICIALES: CategoriaInicial[] = [
  // Gastos fijos
  { nombre: "Alquiler", tipo: "gasto", esFijo: true },
  { nombre: "Expensas", tipo: "gasto", esFijo: true },
  { nombre: "Luz", tipo: "gasto", esFijo: true },
  { nombre: "Gas", tipo: "gasto", esFijo: true },
  { nombre: "Agua", tipo: "gasto", esFijo: true },
  { nombre: "Internet", tipo: "gasto", esFijo: true },
  { nombre: "Celular", tipo: "gasto", esFijo: true },
  { nombre: "Prepaga", tipo: "gasto", esFijo: true },
  { nombre: "Streaming y suscripciones", tipo: "gasto", esFijo: true },
  { nombre: "Educación", tipo: "gasto", esFijo: true },

  // Gastos variables
  { nombre: "Supermercado", tipo: "gasto", esFijo: false },
  { nombre: "Transporte", tipo: "gasto", esFijo: false },
  { nombre: "Nafta", tipo: "gasto", esFijo: false },
  { nombre: "Salidas y ocio", tipo: "gasto", esFijo: false },
  { nombre: "Ropa", tipo: "gasto", esFijo: false },
  { nombre: "Salud", tipo: "gasto", esFijo: false },
  { nombre: "Hogar y mantenimiento", tipo: "gasto", esFijo: false },
  { nombre: "Regalos", tipo: "gasto", esFijo: false },
  { nombre: "Mascotas", tipo: "gasto", esFijo: false },
  { nombre: "Otros gastos", tipo: "gasto", esFijo: false },

  // Ingresos
  { nombre: "Sueldo", tipo: "ingreso", esFijo: true },
  { nombre: "Freelance", tipo: "ingreso", esFijo: false },
  { nombre: "Aguinaldo", tipo: "ingreso", esFijo: false },
  { nombre: "Ayuda familiar", tipo: "ingreso", esFijo: false },
  { nombre: "Otros ingresos", tipo: "ingreso", esFijo: false },
];
