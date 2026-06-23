export const DEFAULT_PRICES = {
  locro_unitario: 10000,
  pastelito_docena: 8000,
  pastelito_media_docena: 4000,
  pastelito_unidad: 700
};

export const calcularTotal = (
  qtyLocro: number,
  qtyBatata: number,
  qtyMembrillo: number,
  prices = DEFAULT_PRICES
) => {
  const totalLocro = qtyLocro * prices.locro_unitario;
  const totalUnidades = qtyBatata + qtyMembrillo;

  const docenas = Math.floor(totalUnidades / 12);
  const resto = totalUnidades % 12;
  const medias = Math.floor(resto / 6);
  const unidades = resto % 6;

  const totalPastelitos = (docenas * prices.pastelito_docena) +
    (medias * prices.pastelito_media_docena) +
    (unidades * prices.pastelito_unidad);

  return totalLocro + totalPastelitos;
};
